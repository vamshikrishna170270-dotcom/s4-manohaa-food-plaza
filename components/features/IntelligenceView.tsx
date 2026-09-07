"use client";

import {
  useState,
  useMemo,
  useRef,
  useEffect,
  type ReactNode,
  type FormEvent,
} from "react";

import {
  DollarSign,
  ShoppingCart,
  Award,
  Calendar,
  Bot,
  Send,
  User,
  CheckCircle2,
  Lightbulb,
  Activity,
  Mic,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  BarChart3,
  MessageSquare,
} from "lucide-react";

import { inr } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

interface DishItem {
  id: string;
  name: string;
  price?: number;
}

interface LedgerEntry {
  id?: string;

  /*
   * If your database contains any of these, we can calculate
   * distinct orders instead of incorrectly assuming:
   * one ledger row === one order.
   */
  order_id?: string;
  transaction_id?: string;
  invoice_id?: string;

  menu_item_id: string;
  quantity?: number;
  total_price?: number;
  created_at: string;

  menu_items?: {
    name: string;
  };
}

interface IntelligenceViewProps {
  dishes?: DishItem[];
  ledger?: LedgerEntry[];
}

type DateFilter =
  | "today"
  | "7d"
  | "30d"
  | "custom";

type ActiveTab =
  | "overview"
  | "expert"
  | "assistant";

type ChatDish = {
  name: string;
  quantity: number;
  revenue: string;
  share?: number;
};

type ChatKpi = {
  label: string;
  value: string;
  note?: string;
};

/* -------------------------------------------------------------------------- */
/* NEW STRUCTURED TABLE TYPES                                                */
/* -------------------------------------------------------------------------- */

type ChatTableColumn = {
  key: string;
  label: string;
  type?: "text" | "number" | "currency";
};

type ChatTable = {
  title?: string;
  columns: ChatTableColumn[];
  rows: Record<string, unknown>[];
};

type ChatData = {
  title?: string;
  subtitle?: string;
  answer?: string;
  sourceNote?: string;
  kpis?: ChatKpi[];
  topDishes?: ChatDish[];
  insights?: string[];
  recommendations?: string[];
};

type WorkspaceMessage = {
  role: "user" | "assistant";
  content: string;

  /*
   * Existing rich response support.
   */
  data?: ChatData;

  /*
   * Structured response returned by /api/ai-analysis.
   *
   * Example:
   *
   * {
   *   type: "table",
   *   table: {
   *     title: "Dish Performance",
   *     columns: [...],
   *     rows: [...]
   *   }
   * }
   */
  responseType?: "text" | "table";

  table?: ChatTable;

  summary?: {
    totalDishes?: number;
    totalUnits?: number;
    totalRevenue?: number;
    topDish?: string | null;
  };
};

type VoiceRecognitionEvent = {
  results: ArrayLike<
    ArrayLike<{
      transcript?: string;
    }>
  >;
};

type VoiceRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult:
    | ((event: VoiceRecognitionEvent) => void)
    | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
};

type VoiceRecognitionConstructor =
  new () => VoiceRecognition;

type VoiceRecognitionWindow = Window & {
  SpeechRecognition?: VoiceRecognitionConstructor;
  webkitSpeechRecognition?: VoiceRecognitionConstructor;
};

type ExpertReport = {
  summary: string[];
  whatChanged: string[];
  attention: string[];
  recommendations: string[];
};

/* -------------------------------------------------------------------------- */
/* CONSTANTS                                                                  */
/* -------------------------------------------------------------------------- */

const DATE_OPTIONS: Array<{
  id: DateFilter;
  label: string;
}> = [
  {
    id: "today",
    label: "Today",
  },
  {
    id: "7d",
    label: "7 Days",
  },
  {
    id: "30d",
    label: "30 Days",
  },
  {
    id: "custom",
    label: "Custom",
  },
];

const MAX_CHAT_HISTORY = 8;
const MAX_PROMPT_LENGTH = 2000;

/* -------------------------------------------------------------------------- */
/* DATE UTILITIES                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Return a YYYY-MM-DD date using the browser's local timezone.
 *
 * This avoids UTC conversion issues where late-night Indian time
 * can accidentally become the previous UTC date.
 */
function localDateString(date: Date) {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    date.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function startOfLocalDay(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0,
    0,
  );
}

function endOfLocalDay(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
}

function getRangeStart(
  filter: DateFilter,
) {
  const now = new Date();

  const today = startOfLocalDay(now);

  switch (filter) {
    case "today":
      return today;

    case "7d": {
      const date = new Date(today);

      date.setDate(
        date.getDate() - 6,
      );

      return date;
    }

    case "30d": {
      const date = new Date(today);

      date.setDate(
        date.getDate() - 29,
      );

      return date;
    }

    default:
      return today;
  }
}

/* -------------------------------------------------------------------------- */
/* VALIDATION UTILITIES                                                       */
/* -------------------------------------------------------------------------- */

function isValidDateString(value: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value,
    )
  ) {
    return false;
  }

  const parsed = new Date(
    `${value}T00:00:00`,
  );

  return !Number.isNaN(
    parsed.getTime(),
  );
}

/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                  */
/* -------------------------------------------------------------------------- */

export default function IntelligenceView({
  dishes = [],
  ledger = [],
}: IntelligenceViewProps) {
  /* ------------------------------------------------------------------------ */
  /* UI STATE                                                                 */
  /* ------------------------------------------------------------------------ */

  const [activeTab, setActiveTab] =
    useState<ActiveTab>("overview");

  const [dateFilter, setDateFilter] =
    useState<DateFilter>("30d");

  /*
   * Production UX:
   *
   * Default = only current selection is active.
   * Clicking Change temporarily enables all choices.
   */
  const [
    isTimeframeEditing,
    setIsTimeframeEditing,
  ] = useState(false);

  const [startDate, setStartDate] =
    useState(() => {
      const date = new Date();

      date.setDate(
        date.getDate() - 29,
      );

      return localDateString(date);
    });

  const [endDate, setEndDate] =
    useState(() =>
      localDateString(new Date()),
    );

  /* ------------------------------------------------------------------------ */
  /* CHAT STATE                                                               */
  /* ------------------------------------------------------------------------ */

  const [
    workspaceInput,
    setWorkspaceInput,
  ] = useState("");

  const [
    workspaceMessages,
    setWorkspaceMessages,
  ] = useState<WorkspaceMessage[]>([
    {
      role: "assistant",
      content:
        "Ask about revenue, orders, a dish, the best seller, or a management decision. I’ll answer only what you asked and keep the response scoped to the selected timeframe.",
    },
  ]);

  const [
    isWorkspaceThinking,
    setIsWorkspaceThinking,
  ] = useState(false);

  const [
    isListening,
    setIsListening,
  ] = useState(false);

  /* ------------------------------------------------------------------------ */
  /* REFS                                                                     */
  /* ------------------------------------------------------------------------ */

  const workspaceEndRef =
    useRef<HTMLDivElement | null>(null);

  const workspaceAbortRef =
    useRef<AbortController | null>(null);

  /* ------------------------------------------------------------------------ */
  /* FILTERED LEDGER                                                          */
  /* ------------------------------------------------------------------------ */

  const filteredLedger = useMemo(() => {
    const now = new Date();

    let rangeStart: Date;
    let rangeEnd: Date;

    if (
      dateFilter === "custom"
    ) {
      /*
       * Protect against malformed manually-controlled values.
       */
      if (
        !isValidDateString(
          startDate,
        ) ||
        !isValidDateString(
          endDate,
        )
      ) {
        return [];
      }

      const [sy, sm, sd] =
        startDate
          .split("-")
          .map(Number);

      const [ey, em, ed] =
        endDate
          .split("-")
          .map(Number);

      rangeStart = new Date(
        sy,
        sm - 1,
        sd,
        0,
        0,
        0,
        0,
      );

      rangeEnd = new Date(
        ey,
        em - 1,
        ed,
        23,
        59,
        59,
        999,
      );
    } else {
      rangeStart =
        getRangeStart(
          dateFilter,
        );

      rangeEnd =
        endOfLocalDay(now);
    }

    const startMs =
      rangeStart.getTime();

    const endMs =
      rangeEnd.getTime();

    /*
     * Invalid custom ranges return no data instead of
     * producing unpredictable results.
     */
    if (endMs < startMs) {
      return [];
    }

    return ledger.filter(
      (entry) => {
        if (!entry?.created_at) {
          return false;
        }

        const timestamp =
          new Date(
            entry.created_at,
          ).getTime();

        if (
          !Number.isFinite(
            timestamp,
          )
        ) {
          return false;
        }

        return (
          timestamp >= startMs &&
          timestamp <= endMs
        );
      },
    );
  }, [
    ledger,
    dateFilter,
    startDate,
    endDate,
  ]);

  /* ------------------------------------------------------------------------ */
  /* DISH BREAKDOWN                                                           */
  /* ------------------------------------------------------------------------ */

  const dishBreakdown = useMemo(() => {
    const map: Record<
      string,
      {
        id: string;
        name: string;
        quantity: number;
        revenue: number;
      }
    > = {};

    for (const entry of filteredLedger) {
      const id = String(
        entry.menu_item_id ??
          "unknown",
      );

      const name =
        entry.menu_items?.name ||
        dishes.find(
          (dish) =>
            dish.id === id,
        )?.name ||
        "Unassigned Item";

      if (!map[id]) {
        map[id] = {
          id,
          name,
          quantity: 0,
          revenue: 0,
        };
      }

      const rawQuantity =
        Number(entry.quantity);

      /*
       * If quantity is missing, assume one.
       *
       * If it is invalid, also assume one.
       */
      const quantity =
        entry.quantity != null &&
        Number.isFinite(
          rawQuantity,
        )
          ? Math.max(
              0,
              rawQuantity,
            )
          : 1;

      const rawRevenue =
        Number(
          entry.total_price,
        );

      const revenue =
        Number.isFinite(
          rawRevenue,
        )
          ? Math.max(
              0,
              rawRevenue,
            )
          : 0;

      map[id].quantity +=
        quantity;

      map[id].revenue +=
        revenue;
    }

    return Object.values(
      map,
    ).sort(
      (a, b) =>
        b.revenue - a.revenue ||
        b.quantity - a.quantity,
    );
  }, [
    filteredLedger,
    dishes,
  ]);

  /* ------------------------------------------------------------------------ */
  /* CORE ANALYTICS                                                           */
  /* ------------------------------------------------------------------------ */

  const metrics = useMemo(() => {
    const grossRevenue =
      dishBreakdown.reduce(
        (sum, item) =>
          sum + item.revenue,
        0,
      );

    const totalUnits =
      dishBreakdown.reduce(
        (sum, item) =>
          sum + item.quantity,
        0,
      );

    /*
     * Prefer real order identifiers.
     */
    const distinctOrderIds =
      new Set(
        filteredLedger
          .map(
            (entry) =>
              entry.order_id ||
              entry.transaction_id ||
              entry.invoice_id,
          )
          .filter(Boolean),
      );

    /*
     * If no order identifier exists, fall back to ledger rows.
     * The UI explicitly identifies this as estimated.
     */
    const totalOrders =
      distinctOrderIds.size > 0
        ? distinctOrderIds.size
        : filteredLedger.length;

    const bestSeller =
      dishBreakdown.length
        ? [
            ...dishBreakdown,
          ].sort(
            (a, b) =>
              b.quantity -
                a.quantity ||
              b.revenue -
                a.revenue,
          )[0]
        : null;

    const averageOrderValue =
      totalOrders > 0
        ? grossRevenue /
          totalOrders
        : 0;

    const unitsPerOrder =
      totalOrders > 0
        ? totalUnits /
          totalOrders
        : 0;

    return {
      grossRevenue,
      totalOrders,
      totalUnits,
      bestSeller,
      averageOrderValue,
      unitsPerOrder,

      orderCountEstimated:
        distinctOrderIds.size === 0,
    };
  }, [
    dishBreakdown,
    filteredLedger,
  ]);

  /* ------------------------------------------------------------------------ */
  /* DETERMINISTIC DAILY / EXPERT REPORT                                     */
  /* ------------------------------------------------------------------------ */

  const expertReport =
    useMemo<ExpertReport | null>(
      () => {
        if (
          !dishBreakdown.length &&
          metrics.totalOrders === 0 &&
          metrics.grossRevenue === 0
        ) {
          return null;
        }

        const summary: string[] =
          [];

        const whatChanged: string[] =
          [];

        const attention: string[] =
          [];

        const recommendations: string[] =
          [];

        const timeframeLabel =
          dateFilter === "today"
            ? "Today"
            : dateFilter === "7d"
              ? "the last 7 days"
              : dateFilter === "30d"
                ? "the last 30 days"
                : `${startDate} to ${endDate}`;

        if (
          metrics.grossRevenue >
          0
        ) {
          summary.push(
            `${timeframeLabel} generated ${inr(
              metrics.grossRevenue,
            )} in revenue across ${metrics.totalOrders} orders.`,
          );
        }

        if (
          metrics.bestSeller
        ) {
          summary.push(
            `${metrics.bestSeller.name} leads unit sales with ${metrics.bestSeller.quantity} units.`,
          );
        }

        if (
          metrics.averageOrderValue >
          0
        ) {
          summary.push(
            `Average order value is ${inr(
              metrics.averageOrderValue,
            )} with ${metrics.unitsPerOrder.toFixed(
              2,
            )} units per order.`,
          );
        }

        /*
         * Do NOT pretend one timeframe proves a trend.
         */
        whatChanged.push(
          `${metrics.totalUnits} units were sold during ${timeframeLabel}.`,
        );

        const revenueLeader = [
          ...dishBreakdown,
        ].sort(
          (a, b) =>
            b.revenue -
            a.revenue,
        )[0];

        if (
          revenueLeader
        ) {
          whatChanged.push(
            `${revenueLeader.name} is the highest-revenue dish at ${inr(
              revenueLeader.revenue,
            )}.`,
          );
        }

        if (
          metrics.bestSeller &&
          metrics.grossRevenue > 0
        ) {
          const bestSellerShare =
            (metrics.bestSeller
              .revenue /
              metrics.grossRevenue) *
            100;

          if (
            bestSellerShare >= 25
          ) {
            attention.push(
              `${metrics.bestSeller.name} contributes ${bestSellerShare.toFixed(
                1,
              )}% of total revenue, so maintaining its availability is important.`,
            );
          }
        }

        const lowestRevenueDish = [
          ...dishBreakdown,
        ].sort(
          (a, b) =>
            a.revenue -
            b.revenue,
        )[0];

        if (
          lowestRevenueDish
        ) {
          attention.push(
            `${lowestRevenueDish.name} is currently among the lowest-revenue items in the selected timeframe.`,
          );
        }

        if (
          metrics.bestSeller
        ) {
          recommendations.push(
            `Protect availability of ${metrics.bestSeller.name}, since it leads unit sales.`,
          );
        }

        if (
          metrics.averageOrderValue >
          0
        ) {
          recommendations.push(
            `Use bundles and add-ons to increase the current ${inr(
              metrics.averageOrderValue,
            )} average order value.`,
          );
        }

        if (
          dishBreakdown.length > 1
        ) {
          const topTwo = [
            ...dishBreakdown,
          ].sort(
            (a, b) =>
              b.revenue -
              a.revenue,
          );

          recommendations.push(
            `Prioritize ${topTwo
              .slice(0, 2)
              .map(
                (dish) =>
                  dish.name,
              )
              .join(
                " and ",
              )} in merchandising because they lead current revenue.`,
          );
        }

        return {
          summary:
            summary.slice(0, 4),

          whatChanged:
            whatChanged.slice(0, 3),

          attention:
            attention.slice(0, 3),

          recommendations:
            recommendations.slice(
              0,
              4,
            ),
        };
      },
      [
        dateFilter,
        startDate,
        endDate,
        dishBreakdown,
        metrics,
      ],
    );

  /* ------------------------------------------------------------------------ */
  /* SCROLL CHAT TO BOTTOM                                                    */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    workspaceEndRef.current?.scrollIntoView(
      {
        behavior: "smooth",
        block: "end",
      },
    );
  }, [
    workspaceMessages,
    isWorkspaceThinking,
  ]);

  /* ------------------------------------------------------------------------ */
  /* CLEANUP                                                                  */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    return () => {
      workspaceAbortRef.current?.abort();
    };
  }, []);

  /* ------------------------------------------------------------------------ */
  /* VOICE INPUT                                                              */
  /* ------------------------------------------------------------------------ */

  const handleVoiceInput = (
    setInputMethod: (
      updater:
        | string
        | ((
            previous: string,
          ) => string),
    ) => void,
  ) => {
    const speechWindow =
      window as VoiceRecognitionWindow;

    const SpeechRecognition =
      speechWindow.SpeechRecognition ||
      speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        "Voice recognition is not supported in this browser.",
      );
      return;
    }

    const recognition =
      new SpeechRecognition();

    recognition.continuous =
      false;

    recognition.interimResults =
      false;

    recognition.lang = "en-IN";

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (
      event: VoiceRecognitionEvent,
    ) => {
      const transcript =
        event?.results?.[0]?.[0]
          ?.transcript
          ?.trim();

      if (!transcript) {
        return;
      }

      setInputMethod(
        (
          previous: string,
        ) =>
          previous
            ? `${previous} ${transcript}`
            : transcript,
      );
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  /* ------------------------------------------------------------------------ */
  /* CHAT                                                                     */
  /* ------------------------------------------------------------------------ */

  const handleSendMessage = async (
    event: FormEvent,
  ) => {
    event.preventDefault();

    const prompt =
      workspaceInput.trim();

    if (!prompt) {
      return;
    }

    if (
      isWorkspaceThinking
    ) {
      return;
    }

    const boundedPrompt =
      prompt.slice(
        0,
        MAX_PROMPT_LENGTH,
      );

    setWorkspaceInput("");

    setWorkspaceMessages(
      (previous) => [
        ...previous,
        {
          role: "user",
          content:
            boundedPrompt,
        },
      ],
    );

    setIsWorkspaceThinking(
      true,
    );

    /*
     * Cancel an older request before starting
     * a new one.
     */
    workspaceAbortRef.current?.abort();

    const controller =
      new AbortController();

    workspaceAbortRef.current =
      controller;

    /*
     * Send a small bounded history.
     */
    const history =
      workspaceMessages
        .slice(
          -MAX_CHAT_HISTORY,
        )
        .map(
          (message) => ({
            role:
              message.role,
            content:
              message.content.slice(
                0,
                1000,
              ),
          }),
        );

    /*
     * Backend expects timeframe.
     *
     * Custom dates are also sent separately in range.
     */
    const backendTimeframe =
      dateFilter === "custom"
        ? "30d"
        : dateFilter;

    try {
      const response =
        await fetch(
          "/api/ai-analysis",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            signal:
              controller.signal,

            body: JSON.stringify({
              mode: "chat",

              userPrompt:
                boundedPrompt,

              history,

              timeframe:
                backendTimeframe,

              range:
                dateFilter ===
                "custom"
                  ? {
                      kind: "custom",
                      startDate,
                      endDate,
                    }
                  : {
                      kind: dateFilter,
                    },
            }),
          },
        );

      if (!response.ok) {
        throw new Error(
          `Chat request failed: ${response.status}`,
        );
      }

      const responseData =
        await response.json();

      if (
        controller.signal
          .aborted
      ) {
        return;
      }

      setWorkspaceMessages(
        (previous) => [
          ...previous,
          {
            role: "assistant",

            content:
              responseData.reply ||
              "I couldn't generate a response from the available data.",

            /*
             * Existing rich data support.
             */
            data:
              responseData.data &&
              typeof responseData.data ===
                "object"
                ? responseData.data
                : undefined,

            /*
             * NEW:
             * Save structured response type.
             */
            responseType:
              responseData.type ===
              "table"
                ? "table"
                : "text",

            /*
             * NEW:
             * Save the actual structured table.
             */
            table:
              responseData.table &&
              typeof responseData.table ===
                "object"
                ? responseData.table
                : undefined,

            /*
             * Optional summary information.
             */
            summary:
              responseData.summary &&
              typeof responseData.summary ===
                "object"
                ? responseData.summary
                : undefined,
          },
        ],
      );
    } catch (error: unknown) {
      if (
        error instanceof
          DOMException &&
        error.name ===
          "AbortError"
      ) {
        return;
      }

      if (
        !controller.signal
          .aborted
      ) {
        setWorkspaceMessages(
          (previous) => [
            ...previous,
            {
              role: "assistant",
              content:
                "I couldn't complete that request. Try a more specific question such as revenue, orders, best seller, a dish, or recommendations.",
            },
          ],
        );
      }
    } finally {
      if (
        !controller.signal
          .aborted
      ) {
        setIsWorkspaceThinking(
          false,
        );
      }
    }
  };

  /* ------------------------------------------------------------------------ */
  /* TIMEFRAME HANDLING                                                       */
  /* ------------------------------------------------------------------------ */

  const setDate = (
    nextDate: DateFilter,
  ) => {
    setDateFilter(nextDate);

    /*
     * As soon as a valid timeframe is selected,
     * return to locked mode.
     */
    setIsTimeframeEditing(
      false,
    );
  };

  const handleStartDateChange = (
    value: string,
  ) => {
    if (
      !isValidDateString(value)
    ) {
      return;
    }

    /*
     * Never allow start > end.
     * When that happens, move end to start.
     */
    if (
      isValidDateString(
        endDate,
      ) &&
      value > endDate
    ) {
      setEndDate(value);
    }

    setStartDate(value);
  };

  const handleEndDateChange = (
    value: string,
  ) => {
    if (
      !isValidDateString(value)
    ) {
      return;
    }

    if (value < startDate) {
      return;
    }

    setEndDate(value);
  };

  const isCustomRangeInvalid =
    dateFilter === "custom" &&
    (!isValidDateString(
      startDate,
    ) ||
      !isValidDateString(
        endDate,
      ) ||
      endDate < startDate);

  /* ------------------------------------------------------------------------ */
  /* STRUCTURED AI TABLE RENDERER                                             */
  /* ------------------------------------------------------------------------ */

  const renderWorkspaceTable = (
    table?: ChatTable,
  ) => {
    if (
      !table ||
      !Array.isArray(
        table.columns,
      ) ||
      !Array.isArray(table.rows)
    ) {
      return null;
    }

    if (!table.columns.length) {
      return null;
    }

    return (
      <div className="mt-4 w-full overflow-hidden rounded-2xl border border-white/10 bg-black/20 shadow-xl">
        {/* Table Header */}
        {table.title && (
          <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.025] px-4 py-3 sm:px-5 sm:py-4">
            <div>
              <h3 className="text-sm font-bold text-white">
                {table.title}
              </h3>

              <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-zinc-600">
                AI database report
              </p>
            </div>

            <div className="rounded-lg border border-white/5 bg-white/[0.025] px-2.5 py-1 text-[10px] font-semibold text-zinc-500">
              {table.rows.length}{" "}
              {table.rows.length ===
              1
                ? "item"
                : "items"}
            </div>
          </div>
        )}

        {/* Horizontal scrolling on small screens */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                {/* Ranking column */}
                <th className="w-16 px-4 py-3 text-left text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-600 sm:px-5">
                  #
                </th>

                {table.columns.map(
                  (column) => (
                    <th
                      key={
                        column.key
                      }
                      className={`px-4 py-3 text-left text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-600 sm:px-5 ${
                        column.type ===
                          "number" ||
                        column.type ===
                          "currency"
                          ? "text-right"
                          : ""
                      }`}
                    >
                      {
                        column.label
                      }
                    </th>
                  ),
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-white/5">
              {table.rows.map(
                (
                  row,
                  rowIndex,
                ) => (
                  <tr
                    key={
                      rowIndex
                    }
                    className="transition-colors hover:bg-white/[0.03]"
                  >
                    {/* Rank */}
                    <td className="px-4 py-3.5 font-mono text-[10px] text-zinc-700 sm:px-5">
                      {rowIndex +
                        1}
                    </td>

                    {table.columns.map(
                      (column) => {
                        const value =
                          row[
                            column.key
                          ];

                        let displayValue =
                          "";

                        if (
                          column.type ===
                          "currency"
                        ) {
                          const numericValue =
                            Number(
                              value ??
                                0,
                            );

                          displayValue =
                            inr(
                              Number.isFinite(
                                numericValue,
                              )
                                ? numericValue
                                : 0,
                            );
                        } else if (
                          column.type ===
                          "number"
                        ) {
                          const numericValue =
                            Number(
                              value ??
                                0,
                            );

                          displayValue =
                            Number.isFinite(
                              numericValue,
                            )
                              ? numericValue.toLocaleString(
                                  "en-IN",
                                )
                              : "0";
                        } else {
                          displayValue =
                            value == null
                              ? "—"
                              : String(
                                  value,
                                );
                        }

                        const isNumeric =
                          column.type ===
                            "number" ||
                          column.type ===
                            "currency";

                        return (
                          <td
                            key={
                              column.key
                            }
                            className={`px-4 py-3.5 text-sm sm:px-5 ${
                              isNumeric
                                ? "text-right font-mono"
                                : ""
                            } ${
                              column.type ===
                              "currency"
                                ? "font-bold text-emerald-400"
                                : column.type ===
                                    "number"
                                  ? "text-zinc-300"
                                  : "font-medium text-zinc-200"
                            }`}
                          >
                            {
                              displayValue
                            }
                          </td>
                        );
                      },
                    )}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>

        {/* Empty state */}
        {!table.rows.length && (
          <div className="px-6 py-12 text-center text-xs text-zinc-600">
            No matching data was found
            for this timeframe.
          </div>
        )}
      </div>
    );
  };

  /* ------------------------------------------------------------------------ */
  /* EXISTING CHAT DATA RENDERER                                              */
  /* ------------------------------------------------------------------------ */

  const renderChatData = (
    data?: ChatData,
  ) => {
    if (!data) {
      return null;
    }

    return (
      <div className="mt-4 w-full space-y-4">
        {(data.title ||
          data.subtitle) && (
          <div className="border-b border-white/5 pb-3">
            {data.title && (
              <h3 className="text-sm font-bold text-white sm:text-base">
                {data.title}
              </h3>
            )}

            {data.subtitle && (
              <p className="mt-1 text-[11px] leading-5 text-zinc-500">
                {data.subtitle}
              </p>
            )}
          </div>
        )}

        {data.answer && (
          <div className="rounded-xl border border-amber-400/10 bg-amber-400/[0.04] p-3.5 text-[13px] leading-6 text-zinc-200 sm:p-4">
            {data.answer}
          </div>
        )}

        {!!data.kpis?.length && (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {data.kpis.map(
              (item) => (
                <div
                  key={
                    item.label
                  }
                  className="rounded-xl border border-white/5 bg-black/15 p-3"
                >
                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-600">
                    {item.label}
                  </p>

                  <p className="mt-1 text-base font-bold text-white sm:text-lg">
                    {item.value}
                  </p>

                  {item.note && (
                    <p className="mt-0.5 text-[10px] text-zinc-600">
                      {item.note}
                    </p>
                  )}
                </div>
              ),
            )}
          </div>
        )}

        {!!data.topDishes?.length && (
          <div className="overflow-hidden rounded-xl border border-white/5 bg-black/10">
            <div className="border-b border-white/5 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                Dish Performance
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/5 text-[9px] font-bold uppercase tracking-widest text-zinc-700">
                    <th className="px-3 py-2">
                      #
                    </th>

                    <th className="px-3 py-2">
                      Dish
                    </th>

                    <th className="px-3 py-2 text-right">
                      Units
                    </th>

                    <th className="px-3 py-2 text-right">
                      Revenue
                    </th>

                    <th className="px-3 py-2 text-right">
                      Share
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/5">
                  {data.topDishes.map(
                    (
                      dish,
                      index,
                    ) => (
                      <tr
                        key={`${dish.name}-${index}`}
                        className="hover:bg-white/[0.025]"
                      >
                        <td className="px-3 py-2.5 font-mono text-[10px] text-zinc-700">
                          {index +
                            1}
                        </td>

                        <td className="px-3 py-2.5 text-xs font-semibold text-zinc-200">
                          {
                            dish.name
                          }
                        </td>

                        <td className="px-3 py-2.5 text-right font-mono text-xs text-zinc-400">
                          {
                            dish.quantity
                          }
                        </td>

                        <td className="px-3 py-2.5 text-right font-mono text-xs font-bold text-emerald-400">
                          {
                            dish.revenue
                          }
                        </td>

                        <td className="px-3 py-2.5 text-right font-mono text-[10px] text-zinc-500">
                          {(
                            dish.share ??
                            0
                          ).toFixed(
                            1,
                          )}
                          %
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!!data.insights?.length && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
              Key Findings
            </p>

            <div className="space-y-2">
              {data.insights.map(
                (
                  item,
                  index,
                ) => (
                  <div
                    key={
                      index
                    }
                    className="flex gap-2.5 rounded-xl border border-white/5 bg-white/[0.012] px-3 py-2.5"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />

                    <p className="text-xs leading-5 text-zinc-300">
                      {item}
                    </p>
                  </div>
                ),
              )}
            </div>
          </div>
        )}

        {!!data.recommendations?.length && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
              Manager Actions
            </p>

            <div className="space-y-2">
              {data.recommendations.map(
                (
                  item,
                  index,
                ) => (
                  <div
                    key={
                      index
                    }
                    className="flex gap-2.5 rounded-xl border border-white/5 bg-white/[0.012] px-3 py-2.5"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400/10 text-[9px] font-bold text-amber-400">
                      {index +
                        1}
                    </span>

                    <p className="text-xs leading-5 text-zinc-300">
                      {item}
                    </p>
                  </div>
                ),
              )}
            </div>
          </div>
        )}

        {data.sourceNote && (
          <p className="rounded-lg border border-white/5 bg-black/10 px-3 py-2 text-[10px] leading-5 text-zinc-500">
            {data.sourceNote}
          </p>
        )}
      </div>
    );
  };

  /* ------------------------------------------------------------------------ */
  /* RENDER                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <>
      <style jsx global>{`
        html:has(.intelligence-root),
        body:has(.intelligence-root) {
          overflow: hidden !important;
          height: 100%;
        }

        .intelligence-root {
          min-height: 0;
          min-width: 0;
          overflow: hidden;
        }

        .intelligence-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
        }

        .intelligence-scroll::-webkit-scrollbar {
          width: 0;
          height: 0;
          display: none;
        }

        .intelligence-no-scrollbar {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .intelligence-no-scrollbar::-webkit-scrollbar {
          width: 0;
          height: 0;
          display: none;
        }
      `}</style>

      <div className="intelligence-root flex h-full min-h-0 max-h-[100dvh] w-full min-w-0 max-w-full flex-col overflow-hidden bg-transparent font-sans text-zinc-100">
        {/* ---------------------------------------------------------------- */}
        {/* GLOBAL HEADER                                                    */}
        {/* ---------------------------------------------------------------- */}

        <header className="relative z-20 flex min-w-0 shrink-0 flex-col gap-3 border-b border-white/5 bg-black/10 px-3 py-2.5 backdrop-blur-xl sm:gap-4 sm:px-6 sm:py-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-7">
            {/* Brand */}
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10">
                <Activity className="h-4.5 w-4.5 text-amber-400" />
              </div>

              <div>
                <h1 className="text-base font-bold tracking-tight text-white sm:text-lg">
                  Deep Intelligence
                </h1>

                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-600">
                  Operations intelligence
                </p>
              </div>
            </div>

            {/* Tabs */}
            <nav className="intelligence-no-scrollbar flex min-w-0 max-w-full items-center gap-1 overflow-x-auto pb-0.5">
              {(
                [
                  [
                    "overview",
                    "Overview",
                    BarChart3,
                  ],
                  [
                    "expert",
                    "Daily Report",
                    Sparkles,
                  ],
                  [
                    "assistant",
                    "AI Workspace",
                    MessageSquare,
                  ],
                ] as const
              ).map(
                ([
                  tab,
                  label,
                  Icon,
                ]) => {
                  const isActive =
                    activeTab ===
                    tab;

                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() =>
                        setActiveTab(
                          tab,
                        )
                      }
                      className={`group inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all sm:px-3.5 ${
                        isActive
                          ? "bg-white/[0.06] text-amber-400 shadow-sm"
                          : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-200"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />

                      <span>
                        {label}
                      </span>
                    </button>
                  );
                },
              )}
            </nav>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* TIMEFRAME SELECTOR                                              */}
          {/* ---------------------------------------------------------------- */}

          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 xl:w-auto xl:justify-end">
            <div className="intelligence-no-scrollbar flex min-w-0 max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-white/5 bg-white/[0.02] p-1 backdrop-blur-md">
              {DATE_OPTIONS.map(
                ({
                  id,
                  label,
                }) => {
                  const isActive =
                    dateFilter ===
                    id;

                  /*
                   * Production UX:
                   *
                   * Current timeframe remains visible and selected.
                   * Everything else appears disabled until Change is clicked.
                   */
                  const isLocked =
                    !isTimeframeEditing &&
                    !isActive;

                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={
                        isLocked
                      }
                      title={
                        isLocked
                          ? "Click Change to select another timeframe"
                          : undefined
                      }
                      onClick={() => {
                        if (
                          isLocked
                        ) {
                          return;
                        }

                        setDate(id);
                      }}
                      className={`
                        relative shrink-0 rounded-lg px-3 py-1.5
                        text-[11px] font-semibold transition-all sm:px-4

                        ${
                          isActive
                            ? "bg-white/10 text-white shadow-sm ring-1 ring-inset ring-white/10"
                            : isLocked
                              ? "cursor-not-allowed text-zinc-800 opacity-45"
                              : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200"
                        }
                      `}
                    >
                      <span className="flex items-center gap-1.5">
                        {label}

                        {isActive && (
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        )}
                      </span>
                    </button>
                  );
                },
              )}

              {/* Change / Done */}
              {!isTimeframeEditing ? (
                <button
                  type="button"
                  onClick={() =>
                    setIsTimeframeEditing(
                      true,
                    )
                  }
                  className="ml-1 shrink-0 rounded-lg border border-white/5 bg-white/[0.025] px-2.5 py-1.5 text-[10px] font-semibold text-zinc-500 transition-all hover:bg-white/[0.05] hover:text-zinc-200"
                >
                  Change
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    setIsTimeframeEditing(
                      false,
                    )
                  }
                  className="ml-1 shrink-0 rounded-lg border border-white/5 bg-white/[0.025] px-2.5 py-1.5 text-[10px] font-semibold text-zinc-500 transition-all hover:bg-white/[0.05] hover:text-zinc-200"
                >
                  Done
                </button>
              )}
            </div>

            {/* Custom dates */}
            {dateFilter ===
              "custom" && (
              <div
                className={`flex shrink-0 items-center gap-2 rounded-xl border bg-white/[0.02] px-3 py-1.5 backdrop-blur-md ${
                  isCustomRangeInvalid
                    ? "border-red-400/30"
                    : "border-white/5"
                }`}
              >
                <Calendar
                  className={`h-3.5 w-3.5 ${
                    isCustomRangeInvalid
                      ? "text-red-400"
                      : "text-zinc-500"
                  }`}
                />

                <input
                  type="date"
                  value={
                    startDate
                  }
                  onChange={(
                    event,
                  ) =>
                    handleStartDateChange(
                      event.target
                        .value,
                    )
                  }
                  className="w-[105px] bg-transparent text-[11px] font-medium text-zinc-300 outline-none"
                  style={{
                    colorScheme:
                      "dark",
                  }}
                />

                <span className="text-zinc-700">
                  –
                </span>

                <input
                  type="date"
                  value={
                    endDate
                  }
                  min={
                    startDate
                  }
                  onChange={(
                    event,
                  ) =>
                    handleEndDateChange(
                      event.target
                        .value,
                    )
                  }
                  className="w-[105px] bg-transparent text-[11px] font-medium text-zinc-300 outline-none"
                  style={{
                    colorScheme:
                      "dark",
                  }}
                />
              </div>
            )}
          </div>
        </header>

        {/* ================================================================== */}
        {/* AI WORKSPACE                                                       */}
        {/* ================================================================== */}

        {activeTab ===
        "assistant" ? (
          <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_50%_0%,rgba(245,158,11,0.08),transparent_62%)]" />

            <div className="intelligence-scroll relative min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
              <div className="mx-auto w-full px-3 pb-8 pt-4 sm:px-6 sm:pt-5 lg:px-10 xl:px-14 2xl:px-16">
                {/* Workspace Header */}
                <div className="mx-auto mb-5 flex w-full max-w-[1500px] items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.018] px-4 py-3 text-xs text-zinc-500 backdrop-blur-xl">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-400">
                    <Bot className="h-4 w-4" />
                  </div>

                  <div className="min-w-0">
                    <p className="font-semibold text-zinc-300">
                      AI Operations Workspace
                    </p>

                    <p className="truncate text-[11px] text-zinc-600">
                      Responses are scoped to your question and selected timeframe.
                    </p>
                  </div>

                  <div className="ml-auto hidden shrink-0 items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-emerald-400/70 sm:flex">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Live
                  </div>
                </div>

                {/* Conversation */}
                <div className="mx-auto w-full max-w-[1500px] space-y-5 sm:space-y-6">
                  {workspaceMessages.map(
                    (
                      message,
                      index,
                    ) => (
                      <div
                        key={index}
                        className={`flex gap-3 sm:gap-4 ${
                          message.role ===
                          "user"
                            ? "ml-auto max-w-4xl flex-row-reverse"
                            : "max-w-5xl"
                        }`}
                      >
                        {/* Avatar */}
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border shadow-sm sm:h-10 sm:w-10 ${
                            message.role ===
                            "user"
                              ? "border-white/10 bg-zinc-200 text-black"
                              : "border-white/10 bg-white/[0.04] text-amber-400"
                          }`}
                        >
                          {message.role ===
                          "user" ? (
                            <User className="h-4 w-4 sm:h-5 sm:w-5" />
                          ) : (
                            <Bot className="h-4 w-4 sm:h-5 sm:w-5" />
                          )}
                        </div>

                        {/* Message */}
                        <div
                          className={`max-w-[94%] rounded-2xl px-3.5 py-3 text-sm shadow-lg sm:max-w-[88%] sm:px-5 sm:py-4 sm:text-[15px] ${
                            message.role ===
                            "user"
                              ? "rounded-tr-sm bg-zinc-800 leading-relaxed text-white"
                              : "rounded-tl-sm border border-white/5 bg-white/[0.025] text-zinc-200 backdrop-blur-xl"
                          }`}
                        >
                          {message.role ===
                          "user" ? (
                            message.content
                          ) : (
                            <>
                              {/* AI response text */}
                              <p className="leading-relaxed text-zinc-300">
                                {
                                  message.content
                                }
                              </p>

                              {/* ------------------------------------------------ */}
                              {/* NEW STRUCTURED TABLE                            */}
                              {/* ------------------------------------------------ */}

                              {message.responseType ===
                                "table" &&
                                renderWorkspaceTable(
                                  message.table,
                                )}

                              {/* ------------------------------------------------ */}
                              {/* OPTIONAL SUMMARY KPIs                          */}
                              {/* ------------------------------------------------ */}

                              {message.responseType ===
                                "table" &&
                                message.summary && (
                                  <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                                    {typeof message
                                      .summary
                                      .totalUnits ===
                                      "number" && (
                                      <div className="rounded-xl border border-white/5 bg-white/[0.015] p-3">
                                        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-600">
                                          Total Units
                                        </p>

                                        <p className="mt-1 text-lg font-bold text-white">
                                          {message.summary.totalUnits.toLocaleString(
                                            "en-IN",
                                          )}
                                        </p>
                                      </div>
                                    )}

                                    {typeof message
                                      .summary
                                      .totalRevenue ===
                                      "number" && (
                                      <div className="rounded-xl border border-white/5 bg-white/[0.015] p-3">
                                        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-600">
                                          Total Revenue
                                        </p>

                                        <p className="mt-1 text-lg font-bold text-emerald-400">
                                          {inr(
                                            message
                                              .summary
                                              .totalRevenue,
                                          )}
                                        </p>
                                      </div>
                                    )}

                                    {message.summary
                                      .topDish && (
                                      <div className="rounded-xl border border-white/5 bg-white/[0.015] p-3">
                                        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-600">
                                          Top Dish
                                        </p>

                                        <p className="mt-1 truncate text-sm font-bold text-amber-400">
                                          {
                                            message
                                              .summary
                                              .topDish
                                          }
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                )}

                              {/* ------------------------------------------------ */}
                              {/* EXISTING RICH DATA                             */}
                              {/* ------------------------------------------------ */}

                              {renderChatData(
                                message.data,
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ),
                  )}

                  {/* Loading */}
                  {isWorkspaceThinking && (
                    <div className="flex gap-3 sm:gap-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-amber-400 sm:h-10 sm:w-10">
                        <Bot className="h-4 w-4 sm:h-5 sm:w-5" />
                      </div>

                      <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-white/5 bg-white/[0.025] px-5 py-3">
                        {[
                          0,
                          150,
                          300,
                        ].map(
                          (
                            delay,
                          ) => (
                            <span
                              key={
                                delay
                              }
                              className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-500"
                              style={{
                                animationDelay: `${delay}ms`,
                              }}
                            />
                          ),
                        )}
                      </div>
                    </div>
                  )}

                  <div
                    ref={
                      workspaceEndRef
                    }
                    className="h-2"
                  />
                </div>
              </div>
            </div>

            {/* Composer */}
            <div className="relative shrink-0 border-t border-white/5 bg-black/25 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-2xl sm:px-6 lg:px-10 xl:px-14">
              <div className="mx-auto w-full max-w-[1500px]">
                <form
                  onSubmit={
                    handleSendMessage
                  }
                  className="flex w-full gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2 shadow-[0_18px_60px_rgba(0,0,0,0.35)] ring-1 ring-black/20"
                >
                  <div className="relative flex min-w-0 flex-1 items-center">
                    <input
                      type="text"
                      value={
                        workspaceInput
                      }
                      maxLength={
                        MAX_PROMPT_LENGTH
                      }
                      onChange={(
                        event,
                      ) =>
                        setWorkspaceInput(
                          event.target
                            .value,
                        )
                      }
                      placeholder={
                        isListening
                          ? "Listening..."
                          : "Ask one thing about your business..."
                      }
                      className="w-full bg-transparent px-4 py-3 pr-12 text-sm text-white outline-none placeholder:text-zinc-600 sm:text-[15px]"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        handleVoiceInput(
                          setWorkspaceInput,
                        )
                      }
                      aria-label={
                        isListening
                          ? "Listening for voice input"
                          : "Use voice input"
                      }
                      className={`absolute right-2 rounded-xl p-2.5 transition-all ${
                        isListening
                          ? "animate-pulse text-red-400"
                          : "text-zinc-500 hover:bg-white/[0.05] hover:text-white"
                      }`}
                    >
                      <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={
                      !workspaceInput.trim() ||
                      isWorkspaceThinking
                    }
                    className="shrink-0 rounded-xl bg-white px-4 py-3 text-sm font-bold text-black transition-all hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98] sm:px-6"
                  >
                    <span className="flex items-center gap-2">
                      <Send className="h-4 w-4" />

                      <span className="hidden sm:inline">
                        Send
                      </span>
                    </span>
                  </button>
                </form>

                <div className="mt-2 flex items-center justify-center gap-2 text-[10px] font-medium uppercase tracking-[0.15em] text-zinc-700">
                  <Sparkles className="h-3 w-3" />
                  Live database context enabled
                </div>
              </div>
            </div>
          </section>
        ) : (
          /* ================================================================= */
          /* DASHBOARD / DAILY REPORT                                          */
          /* ================================================================= */

          <main className="intelligence-scroll relative min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
            <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-full max-w-[1200px] -translate-x-1/2 rounded-full bg-amber-500/[0.035] blur-[110px]" />

            <div className="relative w-full min-w-0 max-w-full px-3 py-4 sm:px-6 sm:py-5 lg:px-8 xl:px-10">
              {/* ============================================================= */}
              {/* OVERVIEW                                                       */}
              {/* ============================================================= */}

              {activeTab ===
                "overview" && (
                <div className="mx-auto w-full max-w-[1700px] space-y-6 animate-in fade-in duration-500">
                  {/* KPI CARDS */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
                    {[
                      {
                        title:
                          "Gross Revenue",

                        val: inr(
                          metrics.grossRevenue,
                        ),

                        icon: DollarSign,

                        color:
                          "text-emerald-400",

                        desc:
                          "Total accrued revenue",
                      },

                      {
                        title:
                          "Total Orders",

                        val:
                          metrics.totalOrders,

                        icon: ShoppingCart,

                        color:
                          "text-blue-400",

                        desc:
                          metrics.orderCountEstimated
                            ? "Ledger rows"
                            : "Distinct orders",
                      },

                      {
                        title:
                          "Best Seller",

                        val:
                          metrics
                            .bestSeller
                            ?.name ||
                          "No Data",

                        icon: Award,

                        color:
                          "text-amber-400",

                        desc:
                          metrics
                            .bestSeller
                            ? `${metrics.bestSeller.quantity} units sold`
                            : "—",
                      },
                    ].map(
                      (
                        card,
                        index,
                      ) => (
                        <div
                          key={
                            index
                          }
                          className="group rounded-2xl border border-white/5 bg-white/[0.025] p-4 shadow-lg backdrop-blur-xl transition-all hover:border-white/10 hover:bg-white/[0.04] sm:p-5"
                        >
                          <div className="mb-2 flex items-center justify-between text-zinc-400">
                            <span className="text-[10px] font-bold uppercase tracking-[0.16em]">
                              {
                                card.title
                              }
                            </span>

                            <card.icon
                              className={`h-5 w-5 ${card.color}`}
                            />
                          </div>

                          <div className="mb-1 truncate text-3xl font-bold tracking-tight text-white">
                            {card.val}
                          </div>

                          <div className="text-[10px] font-medium text-zinc-600">
                            {
                              card.desc
                            }
                          </div>
                        </div>
                      ),
                    )}
                  </div>

                  {/* DISH TABLE */}
                  <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] shadow-lg backdrop-blur-xl">
                    <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
                      <div>
                        <h2 className="text-sm font-bold text-white">
                          Itemized Dish Performance
                        </h2>

                        <p className="mt-0.5 text-[11px] text-zinc-600">
                          Revenue contribution for the selected period
                        </p>
                      </div>

                      <span className="rounded-full border border-white/5 bg-white/[0.02] px-2.5 py-1 font-mono text-[10px] text-zinc-500">
                        {
                          dishBreakdown.length
                        }{" "}
                        items
                      </span>
                    </div>

                    <div className="w-full overflow-x-auto">
                      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-white/5 bg-white/[0.01] text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                            <th className="w-16 px-5 py-3">
                              Rank
                            </th>

                            <th className="px-5 py-3">
                              Dish Name
                            </th>

                            <th className="px-5 py-3 text-right">
                              Units
                            </th>

                            <th className="px-5 py-3 text-right">
                              Revenue
                            </th>

                            <th className="w-40 px-5 py-3 text-right">
                              Share
                            </th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-white/5">
                          {dishBreakdown.map(
                            (
                              dish,
                              index,
                            ) => {
                              const share =
                                metrics.grossRevenue >
                                0
                                  ? (dish.revenue /
                                      metrics.grossRevenue) *
                                    100
                                  : 0;

                              return (
                                <tr
                                  key={
                                    dish.id
                                  }
                                  className="transition-colors hover:bg-white/[0.03]"
                                >
                                  <td className="px-5 py-3 font-mono text-xs text-zinc-700">
                                    #
                                    {index +
                                      1}
                                  </td>

                                  <td className="px-5 py-3 font-medium text-zinc-200">
                                    {
                                      dish.name
                                    }
                                  </td>

                                  <td className="px-5 py-3 text-right font-mono text-zinc-400">
                                    {
                                      dish.quantity
                                    }
                                  </td>

                                  <td className="px-5 py-3 text-right font-mono font-bold text-emerald-400">
                                    {inr(
                                      dish.revenue,
                                    )}
                                  </td>

                                  <td className="px-5 py-3 text-right">
                                    <div className="inline-flex w-full items-center justify-end gap-2">
                                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-black/40">
                                        <div
                                          className="h-full rounded-full bg-amber-400"
                                          style={{
                                            width: `${Math.min(
                                              share,
                                              100,
                                            )}%`,
                                          }}
                                        />
                                      </div>

                                      <span className="w-8 text-right font-mono text-[10px] text-zinc-500">
                                        {share.toFixed(
                                          0,
                                        )}
                                        %
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            },
                          )}
                        </tbody>
                      </table>

                      {!dishBreakdown.length && (
                        <div className="px-6 py-16 text-center">
                          <BarChart3 className="mx-auto mb-3 h-7 w-7 text-zinc-700" />

                          <p className="text-sm font-medium text-zinc-400">
                            No data for this period
                          </p>

                          <p className="mt-1 text-xs text-zinc-600">
                            Try another date range or add transactions.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================= */}
              {/* DAILY REPORT                                                   */}
              {/* ============================================================= */}

              {activeTab ===
                "expert" && (
                <div className="mx-auto flex min-h-[calc(100dvh-185px)] w-full max-w-none flex-col animate-in fade-in duration-500 lg:min-h-[calc(100dvh-165px)]">
                  <div className="mb-4 flex min-w-0 flex-col gap-2 border-b border-white/5 pb-4 md:mb-5 md:flex-row md:items-end md:justify-between md:pb-5">
                    <div>
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-amber-400" />

                        <h2 className="text-base font-bold text-white sm:text-lg">
                          Daily Report
                        </h2>
                      </div>

                      <p className="mt-1 text-xs text-zinc-600 sm:text-sm">
                        Operational analysis for the selected timeframe.
                      </p>
                    </div>

                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-700">
                      {dateFilter ===
                      "30d"
                        ? "30 day analysis"
                        : dateFilter ===
                            "7d"
                          ? "7 day analysis"
                          : dateFilter ===
                              "today"
                            ? "Today analysis"
                            : `${startDate} → ${endDate}`}
                    </div>
                  </div>

                  {isCustomRangeInvalid ? (
                    <div className="flex min-h-[45vh] flex-col items-center justify-center rounded-3xl border border-red-400/10 bg-red-400/[0.02] text-center">
                      <AlertTriangle className="mb-3 h-7 w-7 text-red-400/60" />

                      <p className="text-sm font-medium text-zinc-300">
                        Invalid custom range
                      </p>

                      <p className="mt-1 max-w-md text-xs leading-5 text-zinc-600">
                        Choose a valid start and end date before generating the report.
                      </p>
                    </div>
                  ) : expertReport ? (
                    <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 2xl:grid-cols-2 2xl:gap-6">
                      <div className="space-y-5">
                        <ReportSection
                          title="Performance Summary"
                          icon={
                            <CheckCircle2 className="h-4 w-4" />
                          }
                          accent="text-emerald-400"
                          dot="bg-emerald-500"
                          items={
                            expertReport.summary
                          }
                        />

                        <ReportSection
                          title="Observed Signals"
                          icon={
                            <TrendingUp className="h-4 w-4" />
                          }
                          accent="text-blue-400"
                          dot="bg-blue-500"
                          items={
                            expertReport.whatChanged
                          }
                        />
                      </div>

                      <div className="space-y-5">
                        <ReportSection
                          title="Attention Required"
                          icon={
                            <AlertTriangle className="h-4 w-4" />
                          }
                          accent="text-red-400"
                          dot="bg-red-500"
                          items={
                            expertReport.attention
                          }
                        />

                        <div className="space-y-3">
                          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-400">
                            <Lightbulb className="h-4 w-4" />
                            Strategic Recommendations
                          </h3>

                          <div className="grid grid-cols-1 gap-3">
                            {expertReport.recommendations.map(
                              (
                                recommendation,
                                index,
                              ) => (
                                <div
                                  key={
                                    index
                                  }
                                  className="flex gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-5 shadow-lg backdrop-blur-xl transition-colors hover:bg-white/[0.035]"
                                >
                                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400/10">
                                    <span className="text-[10px] font-bold text-amber-400">
                                      {index +
                                        1}
                                    </span>
                                  </div>

                                  <p className="text-sm leading-6 text-zinc-300">
                                    {
                                      recommendation
                                    }
                                  </p>
                                </div>
                              ),
                            )}

                            {!expertReport
                              .recommendations
                              .length && (
                              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 text-sm text-zinc-600">
                                No immediate recommendations from the selected data.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-3xl border border-white/5 bg-white/[0.015] text-center">
                      <BarChart3 className="mb-3 h-7 w-7 text-zinc-700" />

                      <p className="text-sm text-zinc-500">
                        No sales data available for this period.
                      </p>

                      <p className="mt-1 text-xs text-zinc-700">
                        Try another timeframe or add transactions.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </main>
        )}
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* REPORT SECTION                                                             */
/* -------------------------------------------------------------------------- */

function ReportSection({
  title,
  icon,
  accent,
  dot,
  items,
}: {
  title: string;
  icon: ReactNode;
  accent: string;
  dot: string;
  items?: string[];
}) {
  const safeItems =
    items ?? [];

  return (
    <div className="space-y-3">
      <h3
        className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest ${accent}`}
      >
        {icon}
        {title}
      </h3>

      <div className="min-h-[150px] rounded-2xl border border-white/5 bg-white/[0.018] p-5 shadow-lg backdrop-blur-xl sm:p-6">
        {safeItems.length ? (
          <div className="space-y-3">
            {safeItems.map(
              (
                sentence,
                index,
              ) => (
                <p
                  key={
                    index
                  }
                  className="flex items-start gap-3 text-sm leading-6 text-zinc-300"
                >
                  <span
                    className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`}
                  />

                  <span>
                    {sentence}
                  </span>
                </p>
              ),
            )}
          </div>
        ) : (
          <div className="flex min-h-[110px] items-center justify-center text-center text-xs text-zinc-700">
            Nothing requiring attention for this timeframe.
          </div>
        )}
      </div>
    </div>
  );
}