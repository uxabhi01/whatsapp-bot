import { google, sheets_v4 } from "googleapis";

export type ConversationStage =
  | "awaiting_name"
  | "awaiting_requirement"
  | "awaiting_budget"
  | "awaiting_timeline";

export type ConversationState = {
  phone: string;
  stage: ConversationStage;
  name?: string;
  requirement?: string;
  budget?: string;
  timeline?: string;
  initialMessage?: string;
  updatedAt: string;
};

export type AdvanceResult = {
  state: ConversationState;
  reply: string;
  completed: boolean;
};

const CONVERSATIONS_SHEET = process.env.GOOGLE_CONVERSATIONS_SHEET_NAME || "Conversations";
const memoryStore = new Map<string, ConversationState>();

function nowIso() {
  return new Date().toISOString();
}

function cleanValue(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function maybeRequirement(message: string) {
  const normalized = cleanValue(message);
  return normalized.length >= 12 ? normalized : undefined;
}

function getSheetsConfig() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  if (!email || !key || !spreadsheetId) {
    return null;
  }

  return {
    email,
    key: key.replace(/\\n/g, "\n"),
    spreadsheetId,
  };
}

async function getSheetsClient() {
  const config = getSheetsConfig();
  if (!config) return null;

  const auth = new google.auth.JWT({
    email: config.email,
    key: config.key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return {
    spreadsheetId: config.spreadsheetId,
    sheets: google.sheets({ version: "v4", auth }),
  };
}

async function ensureSheetExists(sheets: sheets_v4.Sheets, spreadsheetId: string, title: string) {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = spreadsheet.data.sheets?.some((sheet) => sheet.properties?.title === title);

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: { title },
            },
          },
        ],
      },
    });
  }
}

function stateToRow(state: ConversationState) {
  return [
    state.phone,
    state.stage,
    state.name || "",
    state.requirement || "",
    state.budget || "",
    state.timeline || "",
    state.initialMessage || "",
    state.updatedAt,
  ];
}

function withOptionalFields(
  base: {
    phone: string;
    stage: ConversationStage;
    updatedAt: string;
  },
  fields: Partial<Omit<ConversationState, "phone" | "stage" | "updatedAt">>,
) {
  const nextState: ConversationState = { ...base };

  if (fields.name) nextState.name = fields.name;
  if (fields.requirement) nextState.requirement = fields.requirement;
  if (fields.budget) nextState.budget = fields.budget;
  if (fields.timeline) nextState.timeline = fields.timeline;
  if (fields.initialMessage) nextState.initialMessage = fields.initialMessage;

  return nextState;
}

function rowToState(row: string[]): ConversationState {
  const fields: Partial<Omit<ConversationState, "phone" | "stage" | "updatedAt">> = {};

  if (row[2]) fields.name = row[2];
  if (row[3]) fields.requirement = row[3];
  if (row[4]) fields.budget = row[4];
  if (row[5]) fields.timeline = row[5];
  if (row[6]) fields.initialMessage = row[6];

  return withOptionalFields(
    {
      phone: row[0] || "",
      stage: (row[1] as ConversationStage) || "awaiting_name",
      updatedAt: row[7] || nowIso(),
    },
    fields,
  );
}

async function readStateFromSheets(phone: string) {
  const client = await getSheetsClient();
  if (!client) return null;

  await ensureSheetExists(client.sheets, client.spreadsheetId, CONVERSATIONS_SHEET);
  const response = await client.sheets.spreadsheets.values.get({
    spreadsheetId: client.spreadsheetId,
    range: `${CONVERSATIONS_SHEET}!A:H`,
  });

  const rows = response.data.values || [];
  const rowIndex = rows.findIndex((row) => row[0] === phone);
  if (rowIndex === -1) return null;
  const row = rows[rowIndex];
  if (!row) return null;

  return {
    index: rowIndex + 1,
    state: rowToState(row),
  };
}

async function writeStateToSheets(state: ConversationState) {
  const client = await getSheetsClient();
  if (!client) return false;

  await ensureSheetExists(client.sheets, client.spreadsheetId, CONVERSATIONS_SHEET);

  const existing = await readStateFromSheets(state.phone);
  const row = stateToRow(state);

  if (existing) {
    await client.sheets.spreadsheets.values.update({
      spreadsheetId: client.spreadsheetId,
      range: `${CONVERSATIONS_SHEET}!A${existing.index}:H${existing.index}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [row] },
    });
  } else {
    await client.sheets.spreadsheets.values.append({
      spreadsheetId: client.spreadsheetId,
      range: `${CONVERSATIONS_SHEET}!A:H`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [row] },
    });
  }

  return true;
}

async function deleteStateFromSheets(phone: string) {
  const client = await getSheetsClient();
  if (!client) return false;

  const existing = await readStateFromSheets(phone);
  if (!existing) return true;

  const spreadsheet = await client.sheets.spreadsheets.get({ spreadsheetId: client.spreadsheetId });
  const sheet = spreadsheet.data.sheets?.find(
    (item) => item.properties?.title === CONVERSATIONS_SHEET,
  );
  const sheetId = sheet?.properties?.sheetId;

  if (sheetId === undefined) return false;

  await client.sheets.spreadsheets.batchUpdate({
    spreadsheetId: client.spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: existing.index - 1,
              endIndex: existing.index,
            },
          },
        },
      ],
    },
  });

  return true;
}

export async function getConversationState(phone: string) {
  try {
    const sheetState = await readStateFromSheets(phone);
    if (sheetState) return sheetState.state;
  } catch (error) {
    console.warn("Could not read conversation state from Google Sheets. Falling back to memory.", error);
  }

  return memoryStore.get(phone) || null;
}

export async function saveConversationState(state: ConversationState) {
  const normalizedState = { ...state, updatedAt: nowIso() };
  let savedToSheets = false;

  try {
    savedToSheets = await writeStateToSheets(normalizedState);
  } catch (error) {
    console.warn("Could not save conversation state to Google Sheets. Falling back to memory.", error);
  }

  if (!savedToSheets) {
    memoryStore.set(normalizedState.phone, normalizedState);
  } else {
    memoryStore.delete(normalizedState.phone);
  }

  return normalizedState;
}

export async function clearConversationState(phone: string) {
  let deletedFromSheets = false;

  try {
    deletedFromSheets = await deleteStateFromSheets(phone);
  } catch (error) {
    console.warn("Could not clear conversation state from Google Sheets. Clearing memory state only.", error);
  }

  memoryStore.delete(phone);
  return deletedFromSheets;
}

export async function advanceConversation(phone: string, message: string): Promise<AdvanceResult> {
  const normalizedMessage = cleanValue(message);
  const existing = await getConversationState(phone);

  if (!existing) {
    const seededRequirement = maybeRequirement(normalizedMessage);
    const nextState = await saveConversationState({
      phone,
      stage: "awaiting_name",
      ...(seededRequirement ? { requirement: seededRequirement } : {}),
      initialMessage: normalizedMessage,
      updatedAt: nowIso(),
    });

    return {
      state: nextState,
      reply: "Thanks for reaching out. What should I call you?",
      completed: false,
    };
  }

  if (existing.stage === "awaiting_name") {
    const nextState = await saveConversationState({
      ...existing,
      name: normalizedMessage,
      stage: existing.requirement ? "awaiting_budget" : "awaiting_requirement",
      updatedAt: nowIso(),
    });

    return {
      state: nextState,
      reply: existing.requirement
        ? "Thanks. What budget range are you working with for this project?"
        : "Thanks. What do you need help with?",
      completed: false,
    };
  }

  if (existing.stage === "awaiting_requirement") {
    const nextState = await saveConversationState({
      ...existing,
      requirement: normalizedMessage,
      stage: "awaiting_budget",
      updatedAt: nowIso(),
    });

    return {
      state: nextState,
      reply: "Perfect. What budget range are you working with?",
      completed: false,
    };
  }

  if (existing.stage === "awaiting_budget") {
    const nextState = await saveConversationState({
      ...existing,
      budget: normalizedMessage,
      stage: "awaiting_timeline",
      updatedAt: nowIso(),
    });

    return {
      state: nextState,
      reply: "Great. What timeline are you aiming for?",
      completed: false,
    };
  }

  const nextState = await saveConversationState({
    ...existing,
    timeline: normalizedMessage,
    updatedAt: nowIso(),
  });

  return {
    state: nextState,
    reply: "Perfect. I have everything I need and I'm sharing this with the team now.",
    completed: true,
  };
}
