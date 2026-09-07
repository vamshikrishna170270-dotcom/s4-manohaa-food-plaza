import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "groq-sdk/resources/chat/completions";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/* ============================================================================
   CONFIG
============================================================================ */

const MODEL =
  process.env.GROQ_MODEL || "openai/gpt-oss-20b";

const MAX_PROMPT_LENGTH = 2000;
const MAX_HISTORY_MESSAGES = 8;
const MAX_SQL_LENGTH = 6000;
const MAX_RESULT_LENGTH = 16000;

/* ============================================================================
   TYPES
============================================================================ */

type DateFilter =
  | "today"
  | "7d"
  | "30d"
  | "custom";

type RequestRange =
  | {
      kind: "today" | "7d" | "30d";
    }
  | {
      kind: "custom";
      startDate: string;
      endDate: string;
    };

type ChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

type RequestBody = {
  mode?: "chat";
  userPrompt?: string;
  history?: ChatHistoryMessage[];
  timeframe?: DateFilter;
  range?: RequestRange;
};

type ReportRow = {
  "Dish Name": string;
  "Units Sold": number;
  Revenue: number;
};

type TableColumn = {
  key: string;
  label: string;
  type: "text" | "number" | "currency";
};

type ResolvedRange = {
  kind: "today" | "7d" | "30d" | "custom";
  startDate: string;
  endDate: string;
  displayStartDate: string;
  displayEndDate: string;
};

/* ============================================================================
   GROQ
============================================================================ */

function createGroqClient() {
  return new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });
}

/* ============================================================================
   TABLE DEFINITIONS
============================================================================ */

const dishReportColumns: TableColumn[] = [
  {
    key: "Dish Name",
    label: "Dish Name",
    type: "text",
  },
  {
    key: "Units Sold",
    label: "Units Sold",
    type: "number",
  },
  {
    key: "Revenue",
    label: "Revenue",
    type: "currency",
  },
];

/* ============================================================================
   DATE VALIDATION
============================================================================ */

function isValidDateString(
  value: unknown
): value is string {
  if (typeof value !== "string") {
    return false;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value
    .split("-")
    .map(Number);

  const date = new Date(
    year,
    month - 1,
    day
  );

  return (
    date.getFullYear() === year &&
    date.getMonth() + 1 === month &&
    date.getDate() === day
  );
}

/* ============================================================================
   INDIA / KOLKATA DATE HELPERS
============================================================================ */

function getKolkataParts() {
  const parts = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }
  ).formatToParts(new Date());

  const getPart = (type: string) =>
    parts.find(
      (part) => part.type === type
    )?.value ?? "00";

  return {
    year: Number(getPart("year")),
    month: Number(getPart("month")),
    day: Number(getPart("day")),
    hour: Number(getPart("hour")),
    minute: Number(getPart("minute")),
    second: Number(getPart("second")),
  };
}

function formatDate(
  year: number,
  month: number,
  day: number
): string {
  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function addDaysToDateString(
  dateString: string,
  amount: number
): string {
  const [year, month, day] = dateString
    .split("-")
    .map(Number);

  const date = new Date(
    year,
    month - 1,
    day
  );

  date.setDate(
    date.getDate() + amount
  );

  return formatDate(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate()
  );
}

/**
 * Convert Kolkata local date/time to UTC.
 */
function kolkataLocalToUtcIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond = 0
): string {
  const utcMilliseconds =
    Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute,
      second,
      millisecond
    ) -
    5.5 * 60 * 60 * 1000;

  return new Date(
    utcMilliseconds
  ).toISOString();
}

/* ============================================================================
   RANGE RESOLUTION
============================================================================ */

function getPresetRange(
  timeframe: "today" | "7d" | "30d"
): ResolvedRange {
  const now = getKolkataParts();

  const today = formatDate(
    now.year,
    now.month,
    now.day
  );

  let displayStartDate = today;

  if (timeframe === "7d") {
    displayStartDate =
      addDaysToDateString(
        today,
        -6
      );
  }

  if (timeframe === "30d") {
    displayStartDate =
      addDaysToDateString(
        today,
        -29
      );
  }

  const [
    startYear,
    startMonth,
    startDay,
  ] = displayStartDate
    .split("-")
    .map(Number);

  const startDate =
    kolkataLocalToUtcIso(
      startYear,
      startMonth,
      startDay,
      0,
      0,
      0,
      0
    );

  const endDate =
    kolkataLocalToUtcIso(
      now.year,
      now.month,
      now.day,
      23,
      59,
      59,
      999
    );

  return {
    kind: timeframe,
    startDate,
    endDate,
    displayStartDate,
    displayEndDate: today,
  };
}

function getCustomRange(
  startDateString: string,
  endDateString: string
): ResolvedRange {
  if (
    !isValidDateString(startDateString) ||
    !isValidDateString(endDateString)
  ) {
    throw new Error(
      "Invalid custom date range."
    );
  }

  if (
    endDateString < startDateString
  ) {
    throw new Error(
      "Custom end date cannot be before start date."
    );
  }

  const [
    startYear,
    startMonth,
    startDay,
  ] = startDateString
    .split("-")
    .map(Number);

  const [
    endYear,
    endMonth,
    endDay,
  ] = endDateString
    .split("-")
    .map(Number);

  const startDate =
    kolkataLocalToUtcIso(
      startYear,
      startMonth,
      startDay,
      0,
      0,
      0,
      0
    );

  const endDate =
    kolkataLocalToUtcIso(
      endYear,
      endMonth,
      endDay,
      23,
      59,
      59,
      999
    );

  return {
    kind: "custom",
    startDate,
    endDate,
    displayStartDate:
      startDateString,
    displayEndDate:
      endDateString,
  };
}

function resolveRequestRange(
  body: RequestBody
): ResolvedRange {
  const range = body.range;

  if (range?.kind === "custom") {
    return getCustomRange(
      range.startDate,
      range.endDate
    );
  }

  if (
    range?.kind === "today" ||
    range?.kind === "7d" ||
    range?.kind === "30d"
  ) {
    return getPresetRange(
      range.kind
    );
  }

  if (
    body.timeframe === "today" ||
    body.timeframe === "7d" ||
    body.timeframe === "30d"
  ) {
    return getPresetRange(
      body.timeframe
    );
  }

  return getPresetRange("30d");
}

/* ============================================================================
   SQL TOOL
============================================================================ */

const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "run_sql_query",
      description:
        "Execute exactly one read-only PostgreSQL SELECT query against the restaurant database. Use this whenever the user asks for business data, sales, revenue, orders, dishes, quantities, rankings, or recommendations based on sales data.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "One PostgreSQL SELECT query only. The query must read from ledger_entries and/or menu_items and must not modify data.",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
];

/* ============================================================================
   QUERY CLEANING
============================================================================ */

function cleanQuery(
  query: string
): string {
  return query
    .replace(/```sql/gi, "")
    .replace(/```postgresql/gi, "")
    .replace(/```/g, "")
    .trim()
    .replace(/;\s*$/, "")
    .trim();
}

/* ============================================================================
   SQL SAFETY
============================================================================ */

function isReadOnlyQuery(
  query: string
): boolean {
  const normalized =
    query
      .trim()
      .toLowerCase();

  if (
    !normalized.startsWith("select")
  ) {
    return false;
  }

  if (normalized.includes("--")) {
    return false;
  }

  if (normalized.includes("/*")) {
    return false;
  }

  if (normalized.includes("*/")) {
    return false;
  }

  const forbiddenKeywords = [
    "insert ",
    "update ",
    "delete ",
    "drop ",
    "alter ",
    "truncate ",
    "create ",
    "grant ",
    "revoke ",
    "execute ",
    "call ",
    "merge ",
    "replace ",
    "upsert ",
  ];

  return !forbiddenKeywords.some(
    (keyword) =>
      normalized.includes(keyword)
  );
}

/* ============================================================================
   TABLE SAFETY
============================================================================ */

function isAllowedTableQuery(
  query: string
): boolean {
  const normalized =
    query.toLowerCase();

  const allowedTables = new Set([
    "ledger_entries",
    "menu_items",
  ]);

  const matches = [
    ...normalized.matchAll(
      /\b(?:from|join)\s+([a-z_][a-z0-9_]*)/gi
    ),
  ];

  for (const match of matches) {
    const tableName =
      match[1]?.toLowerCase();

    if (
      tableName &&
      !allowedTables.has(
        tableName
      )
    ) {
      return false;
    }
  }

  return true;
}

/* ============================================================================
   TIMEFRAME SAFETY
============================================================================ */

function containsCreatedAtFilter(
  query: string
): boolean {
  return /\bcreated_at\b/i.test(
    query
  );
}

function containsRequiredRange(
  query: string,
  startDate: string,
  endDate: string
): boolean {
  const normalized =
    query
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  const normalizedStart =
    startDate.toLowerCase();

  const normalizedEnd =
    endDate.toLowerCase();

  const startWithoutMilliseconds =
    normalizedStart.replace(
      ".000z",
      "z"
    );

  const endWithoutMilliseconds =
    normalizedEnd.replace(
      ".000z",
      "z"
    );

  const hasStart =
    normalized.includes(
      normalizedStart
    ) ||
    normalized.includes(
      startWithoutMilliseconds
    );

  const hasEnd =
    normalized.includes(
      normalizedEnd
    ) ||
    normalized.includes(
      endWithoutMilliseconds
    );

  return (
    containsCreatedAtFilter(
      query
    ) &&
    hasStart &&
    hasEnd
  );
}

/* ============================================================================
   TABLE INTENT
============================================================================ */

function detectTableIntent(
  prompt: string
): boolean {
  const text =
    prompt
      .toLowerCase()
      .trim();

  const keywords = [
    "report",
    "breakdown",
    "dish performance",
    "dish report",
    "sales report",
    "sales breakdown",
    "top dishes",
    "top selling dishes",
    "best selling dishes",
    "best selling items",
    "items sold",
    "show me the dishes",
    "list the dishes",
    "all dishes",
  ];

  return keywords.some(
    (keyword) =>
      text.includes(keyword)
  );
}

/* ============================================================================
   NUMBER HELPER
============================================================================ */

function toNumber(
  value: unknown
): number {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === "string"
  ) {
    const parsed =
      Number(value);

    return Number.isFinite(
      parsed
    )
      ? parsed
      : 0;
  }

  return 0;
}

/* ============================================================================
   REPORT NORMALIZATION
============================================================================ */

function normalizeReportRows(
  data: unknown[]
): ReportRow[] {
  return data
    .map((row) => {
      if (
        !row ||
        typeof row !== "object"
      ) {
        return null;
      }

      const item =
        row as Record<
          string,
          unknown
        >;

      const dishName =
        item["Dish Name"] ??
        item["dish_name"] ??
        item["name"] ??
        item["dish"] ??
        "Unknown Item";

      const rawUnits =
        item["Units Sold"] ??
        item["units_sold"] ??
        item["quantity"] ??
        item["units"] ??
        0;

      const rawRevenue =
        item["Revenue"] ??
        item["revenue"] ??
        item["total_price"] ??
        item["sales"] ??
        0;

      return {
        "Dish Name":
          String(dishName),

        "Units Sold":
          toNumber(rawUnits),

        Revenue:
          toNumber(rawRevenue),
      };
    })
    .filter(
      (
        row
      ): row is ReportRow =>
        row !== null
    );
}

/* ============================================================================
   SAFE JSON
============================================================================ */

function safeStringify(
  value: unknown
): string {
  let result: string;

  try {
    result =
      JSON.stringify(value) ??
      "[]";
  } catch {
    result = "[]";
  }

  if (
    result.length >
    MAX_RESULT_LENGTH
  ) {
    return (
      result.slice(
        0,
        MAX_RESULT_LENGTH
      ) +
      "...[TRUNCATED]"
    );
  }

  return result;
}

/* ============================================================================
   FORMATTERS
============================================================================ */

function formatINR(
  value: number
): string {
  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }
  ).format(value);
}

/* ============================================================================
   POST
============================================================================ */

export async function POST(
  req: Request
) {
  try {
    /* ==========================================================================
       ENVIRONMENT
    ========================================================================== */

    if (
      !process.env.GROQ_API_KEY
    ) {
      console.error(
        "GROQ_API_KEY is missing."
      );

      return NextResponse.json(
        {
          reply:
            "The AI service is not configured correctly.",
          type: "text",
          grounded: false,
        },
        {
          status: 500,
        }
      );
    }

    if (
      !process.env
        .NEXT_PUBLIC_SUPABASE_URL ||
      !process.env
        .NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      console.error(
        "Supabase environment variables are missing."
      );

      return NextResponse.json(
        {
          reply:
            "The database connection is not configured correctly.",
          type: "text",
          grounded: false,
        },
        {
          status: 500,
        }
      );
    }

    /* ==========================================================================
       SUPABASE
    ========================================================================== */

    const cookieStore =
      await cookies();

    const supabase =
      createServerClient(
        process.env
          .NEXT_PUBLIC_SUPABASE_URL!,
        process.env
          .NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
          },
        }
      );

    /* ==========================================================================
       REQUEST
    ========================================================================== */

    const body =
      (await req.json()) as RequestBody;

    const prompt =
      typeof body?.userPrompt ===
      "string"
        ? body.userPrompt.trim()
        : "";

    if (!prompt) {
      return NextResponse.json(
        {
          error:
            "Valid prompt required.",
        },
        {
          status: 400,
        }
      );
    }

    const boundedPrompt =
      prompt.slice(
        0,
        MAX_PROMPT_LENGTH
      );

    /* ==========================================================================
       RANGE
    ========================================================================== */

    let resolvedRange: ResolvedRange;

    try {
      resolvedRange =
        resolveRequestRange(body);
    } catch (error) {
      console.error(
        "Range resolution error:",
        error
      );

      return NextResponse.json(
        {
          reply:
            "The selected date range is invalid. Please select a valid timeframe.",
          type: "text",
          grounded: false,
        },
        {
          status: 400,
        }
      );
    }

    const {
      startDate,
      endDate,
      displayStartDate,
      displayEndDate,
    } = resolvedRange;

    const timeframeDescription =
      resolvedRange.kind ===
      "today"
        ? "Today"
        : resolvedRange.kind ===
            "7d"
          ? "The last 7 calendar days"
          : resolvedRange.kind ===
              "30d"
            ? "The last 30 calendar days"
            : `Custom range ${displayStartDate} to ${displayEndDate}`;

    /* ==========================================================================
       HISTORY
    ========================================================================== */

    const history: ChatCompletionMessageParam[] =
      Array.isArray(
        body.history
      )
        ? body.history
            .filter(
              (
                message
              ) =>
                message &&
                (
                  message.role ===
                    "user" ||
                  message.role ===
                    "assistant"
                ) &&
                typeof message.content ===
                  "string"
            )
            .slice(
              -MAX_HISTORY_MESSAGES
            )
            .map(
              (
                message
              ) => ({
                role:
                  message.role,
                content:
                  message.content.slice(
                    0,
                    1000
                  ),
              })
            )
        : [];

    /* ==========================================================================
       SYSTEM PROMPT
    ========================================================================== */

    const systemContent = `
You are the AI Operations Intelligence assistant for a restaurant.

Your job is to answer the user's business question using exact data from the
restaurant PostgreSQL database.

You must stay scoped to:
1. The user's current question.
2. The currently selected timeframe.
3. The available database data.

===============================================================================
DATABASE SCHEMA
===============================================================================

TABLE: ledger_entries

Columns:
- id
- menu_item_id
- quantity
- total_price
- created_at

TABLE: menu_items

Columns:
- id
- name

RELATIONSHIP:
ledger_entries.menu_item_id = menu_items.id

===============================================================================
CURRENT TIMEFRAME
===============================================================================

Selected timeframe:
${timeframeDescription}

Display start:
${displayStartDate}

Display end:
${displayEndDate}

UTC START:
${startDate}

UTC END:
${endDate}

Every sales/business query MUST include:

ledger_entries.created_at >= '${startDate}'
AND
ledger_entries.created_at <= '${endDate}'

Use those exact boundaries.

===============================================================================
DATABASE RULES
===============================================================================

1. Use run_sql_query for database-backed business questions.
2. Only generate SELECT queries.
3. Never modify data.
4. Never invent values.
5. Never estimate database values.
6. Revenue comes from ledger_entries.total_price.
7. Units sold comes from ledger_entries.quantity.
8. Dish names come from menu_items.name.
9. Join ledger_entries.menu_item_id = menu_items.id.
10. Do not query tables outside ledger_entries and menu_items.
11. Never use INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE,
    GRANT, REVOKE, EXECUTE, CALL, MERGE, REPLACE or UPSERT.
12. Never use a different timeframe.
13. Never use a previous timeframe over the current timeframe.
14. Never expose SQL to the user.

===============================================================================
QUESTION SCOPING
===============================================================================

Answer ONLY the current question.

Do not automatically add unrelated metrics.

"What is my revenue?"
-> Answer revenue.

"Who is the best seller?"
-> Answer the best-selling dish by units sold.

"How much did Pizza make?"
-> Return Pizza's revenue.

"Give me a dish performance report."
-> Return structured dish-level results.

"What should I do about low-selling dishes?"
-> Retrieve relevant data and provide a practical recommendation.

===============================================================================
REPORT QUERIES
===============================================================================

For dish performance/report questions use:

SELECT
  mi.name AS "Dish Name",
  SUM(COALESCE(le.quantity, 0)) AS "Units Sold",
  SUM(COALESCE(le.total_price, 0)) AS "Revenue"
FROM ledger_entries le
JOIN menu_items mi
  ON le.menu_item_id = mi.id
WHERE
  le.created_at >= '${startDate}'
  AND le.created_at <= '${endDate}'
GROUP BY
  mi.id,
  mi.name
ORDER BY
  "Units Sold" DESC

===============================================================================
BEST SELLER
===============================================================================

Use units sold as the primary ranking metric.

===============================================================================
ORDERS
===============================================================================

The known schema does not guarantee a distinct order identifier.

Do NOT pretend that ledger_entries.id is an order ID.

Do NOT claim a distinct order count unless reliable order information exists.

===============================================================================
EMPTY DATA
===============================================================================

If no matching data exists, clearly state that no matching data was found for
the selected timeframe.

===============================================================================
RESPONSE STYLE
===============================================================================

Be concise, direct and management-oriented.

Use Indian Rupees when discussing money.

Current timeframe always wins over previous conversation context.
`;

    /* ==========================================================================
       INITIAL GROQ CALL
    ========================================================================== */

    const initialMessages: ChatCompletionMessageParam[] =
      [
        {
          role: "system",
          content:
            systemContent,
        },
        ...history,
        {
          role: "user",
          content:
            boundedPrompt,
        },
      ];

    const groq =
      createGroqClient();

    const initialResponse =
      await groq.chat.completions.create(
        {
          model: MODEL,
          messages:
            initialMessages,
          tools,
          tool_choice: "auto",
          temperature: 0.1,
          max_tokens: 1200,
        }
      );

    const assistantMessage =
      initialResponse.choices[0]
        ?.message;

    const toolCalls =
      assistantMessage?.tool_calls ??
      [];

    /* ==========================================================================
       NO TOOL CALL
    ========================================================================== */

    if (!toolCalls.length) {
      return NextResponse.json({
        reply:
          assistantMessage?.content ||
          "I couldn't retrieve the requested business data.",
        type: "text",
        grounded: false,
      });
    }

    const toolCall =
      toolCalls[0];

    if (
      toolCall.type !==
      "function"
    ) {
      return NextResponse.json(
        {
          reply:
            "I couldn't process the analytics request.",
          type: "text",
          grounded: false,
        },
        {
          status: 500,
        }
      );
    }

    /* ==========================================================================
       TOOL ARGUMENTS
    ========================================================================== */

    let args: {
      query?: string;
    };

    try {
      args =
        JSON.parse(
          toolCall.function
            .arguments || "{}"
        ) as {
          query?: string;
        };
    } catch (error) {
      console.error(
        "Tool argument parsing error:",
        error
      );

      return NextResponse.json(
        {
          reply:
            "I couldn't formulate the analytics request correctly.",
          type: "text",
          grounded: false,
        },
        {
          status: 500,
        }
      );
    }

    /* ==========================================================================
       CLEAN SQL
    ========================================================================== */

    const rawQuery =
      typeof args.query ===
      "string"
        ? args.query
        : "";

    const safeQuery =
      cleanQuery(rawQuery);

    if (
      !safeQuery ||
      safeQuery.length >
        MAX_SQL_LENGTH
    ) {
      return NextResponse.json(
        {
          reply:
            "I couldn't generate a valid analytics query.",
          type: "text",
          grounded: false,
        },
        {
          status: 400,
        }
      );
    }

    /* ==========================================================================
       SQL SAFETY
    ========================================================================== */

    if (
      !isReadOnlyQuery(
        safeQuery
      )
    ) {
      console.error(
        "Blocked unsafe SQL:",
        safeQuery
      );

      return NextResponse.json(
        {
          reply:
            "I couldn't safely process that database request.",
          type: "text",
          grounded: false,
        },
        {
          status: 400,
        }
      );
    }

    if (
      !isAllowedTableQuery(
        safeQuery
      )
    ) {
      console.error(
        "Blocked unsupported table query:",
        safeQuery
      );

      return NextResponse.json(
        {
          reply:
            "The analytics request referenced unsupported data.",
          type: "text",
          grounded: false,
        },
        {
          status: 400,
        }
      );
    }

    /* ==========================================================================
       TIMEFRAME SAFETY
    ========================================================================== */

    if (
      !containsCreatedAtFilter(
        safeQuery
      )
    ) {
      console.error(
        "Query missing created_at:",
        safeQuery
      );

      return NextResponse.json(
        {
          reply:
            "I couldn't verify the selected timeframe in the analytics request.",
          type: "text",
          grounded: false,
        },
        {
          status: 400,
        }
      );
    }

    if (
      !containsRequiredRange(
        safeQuery,
        startDate,
        endDate
      )
    ) {
      console.error(
        "Query outside selected timeframe:",
        {
          safeQuery,
          startDate,
          endDate,
        }
      );

      return NextResponse.json(
        {
          reply:
            "I couldn't verify that the analytics request was limited to the selected timeframe. Please try the question again.",
          type: "text",
          grounded: false,
        },
        {
          status: 400,
        }
      );
    }

    /* ==========================================================================
       DATABASE
    ========================================================================== */

    const {
      data,
      error,
    } = await supabase.rpc(
      "execute_read_only_sql",
      {
        sql_query:
          safeQuery,
      }
    );

    if (error) {
      console.error(
        "Supabase RPC error:",
        error.message
      );

      return NextResponse.json(
        {
          reply:
            "I encountered a database error while retrieving the information.",
          type: "text",
          grounded: false,
        },
        {
          status: 500,
        }
      );
    }

    const rows: unknown[] =
      Array.isArray(data)
        ? data
        : [];

    /* ==========================================================================
       TABLE RESPONSE
    ========================================================================== */

    if (
      detectTableIntent(
        boundedPrompt
      )
    ) {
      const reportRows =
        normalizeReportRows(
          rows
        );

      reportRows.sort(
        (a, b) =>
          b["Units Sold"] -
            a["Units Sold"] ||
          b.Revenue -
            a.Revenue
      );

      const totalUnits: number =
        reportRows.reduce(
          (
            total: number,
            row: ReportRow
          ) =>
            total +
            row[
              "Units Sold"
            ],
          0
        );

      const totalRevenue: number =
        reportRows.reduce(
          (
            total: number,
            row: ReportRow
          ) =>
            total +
            row.Revenue,
          0
        );

      const topDish:
        | string
        | null =
        reportRows[0]?.[
          "Dish Name"
        ] || null;

      if (!reportRows.length) {
        return NextResponse.json({
          reply:
            "There is no sales data for the selected timeframe.",
          type: "text",
          grounded: true,
          data: {
            title:
              "Dish Performance",
            subtitle:
              timeframeDescription,
          },
          summary: {
            totalDishes: 0,
            totalUnits: 0,
            totalRevenue: 0,
            topDish: null,
          },
        });
      }

      return NextResponse.json({
        reply:
          topDish
            ? `${topDish} is the top-selling dish for the selected timeframe.`
            : "Here is the dish performance for the selected timeframe.",

        type: "table",

        table: {
          title:
            "Dish Performance",

          columns:
            dishReportColumns,

          rows:
            reportRows,
        },

        summary: {
          totalDishes:
            reportRows.length,
          totalUnits,
          totalRevenue,
          topDish,
        },

        data: {
          title:
            "Dish Performance",
          subtitle:
            timeframeDescription,
          answer:
            topDish
              ? `${topDish} is the top-selling dish for the selected timeframe.`
              : "Here is the dish performance for the selected timeframe.",
          sourceNote:
            "Based only on database records inside the selected timeframe.",
          topDishes:
            reportRows
              .slice(0, 5)
              .map(
                (
                  row: ReportRow
                ) => ({
                  name:
                    row[
                      "Dish Name"
                    ],
                  quantity:
                    row[
                      "Units Sold"
                    ],
                  revenue:
                    formatINR(
                      row.Revenue
                    ),
                })
              ),
        },

        grounded: true,

        timeframe: {
          startDate:
            displayStartDate,
          endDate:
            displayEndDate,
          label:
            timeframeDescription,
        },
      });
    }

    /* ==========================================================================
       NORMAL AI RESPONSE
    ========================================================================== */

    const databaseResult =
      safeStringify(
        rows
      );

    const synthesisMessages: ChatCompletionMessageParam[] =
      [
        {
          role: "system",
          content: `
You are a concise restaurant analytics assistant.

Answer the current user question using ONLY the supplied database result.

CURRENT TIMEFRAME:
${timeframeDescription}

DATABASE RESULT:
${databaseResult}

RULES:
- Never invent numbers.
- Never estimate missing values.
- Answer only the current question.
- Do not add unrelated metrics.
- Do not mention SQL.
- Do not mention internal tools.
- If no matching data exists, clearly say so.
- Use Indian Rupee formatting for money.
- Do not claim distinct orders unless the database result actually contains
  reliable order information.
- Keep the answer concise and useful.
`,
        },
        {
          role: "user",
          content:
            boundedPrompt,
        },
      ];

    const finalResponse =
      await groq.chat.completions.create(
        {
          model: MODEL,
          messages:
            synthesisMessages,
          temperature: 0.1,
          max_tokens: 1000,
        }
      );

    const reply =
      finalResponse.choices[0]
        ?.message?.content?.trim() ||
      "No matching information was found.";

    /* ==========================================================================
       OPTIONAL SUMMARY
    ========================================================================== */

    let summary:
      | {
          totalDishes: number;
          totalUnits: number;
          totalRevenue: number;
          topDish: string | null;
        }
      | undefined;

    if (
      rows.length > 0
    ) {
      const totalUnits: number =
        rows.reduce(
          (
            total: number,
            current: unknown
          ) => {
            if (
              !current ||
              typeof current !==
                "object"
            ) {
              return total;
            }

            const item =
              current as Record<
                string,
                unknown
              >;

            return (
              total +
              toNumber(
                item[
                  "Units Sold"
                ] ??
                  item[
                    "units_sold"
                  ] ??
                  item[
                    "quantity"
                  ] ??
                  item[
                    "units"
                  ]
              )
            );
          },
          0
        );

      const totalRevenue: number =
        rows.reduce(
          (
            total: number,
            current: unknown
          ) => {
            if (
              !current ||
              typeof current !==
                "object"
            ) {
              return total;
            }

            const item =
              current as Record<
                string,
                unknown
              >;

            return (
              total +
              toNumber(
                item[
                  "Revenue"
                ] ??
                  item[
                    "revenue"
                  ] ??
                  item[
                    "total_revenue"
                  ] ??
                  item[
                    "total_price"
                  ]
              )
            );
          },
          0
        );

      const firstRow =
        rows[0];

      let topDish:
        | string
        | null = null;

      if (
        firstRow &&
        typeof firstRow ===
          "object"
      ) {
        const first =
          firstRow as Record<
            string,
            unknown
          >;

        const name =
          first[
            "Dish Name"
          ] ??
          first[
            "dish_name"
          ] ??
          first["name"] ??
          first["dish"];

        if (
          typeof name ===
          "string"
        ) {
          topDish =
            name.trim() ||
            null;
        }
      }

      summary = {
        totalDishes:
          rows.length,
        totalUnits,
        totalRevenue,
        topDish,
      };
    }

    /* ==========================================================================
       FINAL RESPONSE
    ========================================================================== */

    return NextResponse.json({
      reply,
      type: "text",
      grounded: true,
      data: {
        title:
          "Database Analysis",
        subtitle:
          timeframeDescription,
        answer: reply,
        sourceNote:
          "Based only on live database data inside the selected timeframe.",
      },
      ...(summary
        ? {
            summary,
          }
        : {}),
      timeframe: {
        startDate:
          displayStartDate,
        endDate:
          displayEndDate,
        label:
          timeframeDescription,
      },
    });
  } catch (error) {
    console.error(
      "AI Route Error:",
      error
    );

    return NextResponse.json(
      {
        reply:
          "I encountered a connection error while processing the request. Please try again.",
        type: "text",
        grounded: false,
      },
      {
        status: 500,
      }
    );
  }
}