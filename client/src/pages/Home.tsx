import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  CarFront,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Download,
  FileDown,
  FileUp,
  HandCoins,
  Landmark,
  LayoutGrid,
  LockKeyhole,
  MoreHorizontal,
  Plus,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  UserRound,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";

const STORAGE_KEY = "finanwise-offline-v2";

type Tab = "overview" | "finances" | "cards" | "reports";
type Modal = "expense" | "editExpense" | "card" | "editCard" | "launchFinance" | "launchCard" | "payBill" | "anticipate" | "backup" | null;

type Finance = {
  id: string;
  lender: string;
  contract: string;
  vehicle: string;
  plate: string;
  financed: number;
  installment: number;
  term: number;
  paidCount: number;
  firstDue: string;
  monthlyRate: number;
  cet: number;
};

type CardData = {
  id: string;
  name: string;
  bank: string;
  lastFour: string;
  limit: number;
  dueDay: number;
  closingDay: number;
  color: "navy" | "coral" | "lavender" | "graphite";
};

type Expense = {
  id: string;
  cardId: string;
  description: string;
  person: string;
  amount: number;
  installments: number;
  installmentsPaid: number;
  date: string;
};

type PaymentEntry = {
  id: string;
  kind: "finance" | "card" | "bill";
  referenceId: string;
  label: string;
  installmentNumber?: number;
  scheduledAmount: number;
  paidAmount: number;
  discount: number;
  paidAt: string;
  cardId?: string;
  statementKey?: string;
};

type Store = {
  finances: Finance[];
  cards: CardData[];
  expenses: Expense[];
  payments: PaymentEntry[];
};

const seedStore: Store = {
  finances: [
    {
      id: "santander-133171897",
      lender: "Santander",
      contract: "133171897/00711383693",
      vehicle: "Toyota Corolla GLi 1.8 Flex",
      plate: "NNZ2H70",
      financed: 68307.56,
      installment: 2159.58,
      term: 48,
      paidCount: 0,
      firstDue: "2026-05-25",
      monthlyRate: 1.85,
      cet: 2.62,
    },
  ],
  cards: [],
  expenses: [],
  payments: [],
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const fullDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

function money(value: number) {
  return currency.format(value);
}

function dateLabel(value: string, format: "short" | "full" = "short") {
  const date = new Date(`${value}T12:00:00`);
  return (format === "short" ? shortDate : fullDate).format(date).replace(" de ", " ");
}

function addMonths(dateString: string, count: number) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setMonth(date.getMonth() + count);
  return date.toISOString().slice(0, 10);
}

function statementKey(dateString: string, closingDay: number) {
  const date = new Date(`${dateString}T12:00:00`);
  if (date.getDate() > closingDay) date.setMonth(date.getMonth() + 1);
  return date.toISOString().slice(0, 7);
}

function expenseAmountForStatement(expense: Expense, closingDay: number, cycle: string) {
  const installmentAmount = expense.amount / expense.installments;
  return Array.from({ length: expense.installments }, (_, index) =>
    statementKey(addMonths(expense.date, index), closingDay) === cycle ? installmentAmount : 0
  ).reduce((sum, amount) => sum + amount, 0);
}

function cardOutstandingAmount(card: CardData, expenses: Expense[], payments: PaymentEntry[]) {
  const cycles = new Set(
    expenses
      .filter((expense) => expense.cardId === card.id)
      .flatMap((expense) =>
        Array.from({ length: expense.installments }, (_, index) =>
          statementKey(addMonths(expense.date, index), card.closingDay)
        )
      )
  );
  return Array.from(cycles).reduce((total, cycle) => {
    const gross = expenses
      .filter((expense) => expense.cardId === card.id)
      .reduce((sum, expense) => sum + expenseAmountForStatement(expense, card.closingDay, cycle), 0);
    const paid = payments
      .filter((payment) => payment.kind === "bill" && payment.cardId === card.id && payment.statementKey === cycle)
      .reduce((sum, payment) => sum + payment.paidAmount, 0);
    return total + Math.max(0, gross - paid);
  }, 0);
}

function cardColorForBank(bank: string): CardData["color"] {
  const value = bank.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (value.includes("nubank") || value.includes("ultravioleta")) return "graphite";
  if (value.includes("itau") || value.includes("santander") || value.includes("bradesco") || value.includes("pan") || value.includes("will bank")) return "coral";
  if (value.includes("inter") || value.includes("c6") || value.includes("neon") || value.includes("xp") || value.includes("btg")) return "navy";
  return "lavender";
}

function safeLoad(): Store {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return seedStore;
    const parsed = JSON.parse(saved);
    return {
      ...parsed,
      payments: parsed.payments ?? [],
      cards: (parsed.cards ?? []).map((card: CardData) => ({
        ...card,
        dueDay: card.dueDay ?? 10,
        closingDay: card.closingDay ?? 3,
        color: cardColorForBank(`${card.bank} ${card.name}`),
      })),
    };
  } catch {
    return seedStore;
  }
}

function persistStore(store: Store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // O app continua funcional mesmo se o navegador bloquear o armazenamento local.
  }
}

function IconButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button className="icon-button" aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  );
}

function ProgressBar({ value, tone = "blue" }: { value: number; tone?: "blue" | "green" | "coral" }) {
  return (
    <div className={`progress-track ${tone}`}>
      <div className="progress-value" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function ModalShell({ title, eyebrow, onClose, children }: { title: string; eyebrow?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-handle" />
        <div className="modal-heading">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h2>{title}</h2>
          </div>
          <IconButton label="Fechar" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        {children}
      </section>
    </div>
  );
}

export default function Home() {
  const [store, setStore] = useState<Store>(() => safeLoad());
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [selectedCard, setSelectedCard] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [anticipationQty, setAnticipationQty] = useState(2);
  const [expenseForm, setExpenseForm] = useState({
    description: "",
    person: "",
    amount: "",
    installments: "1",
    cardId: "nubank",
    date: new Date().toISOString().slice(0, 10),
  });
  const [cardForm, setCardForm] = useState({
    name: "",
    bank: "",
    lastFour: "",
    limit: "",
    dueDay: "10",
    closingDay: "3",
  });
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [launchingFinanceNumber, setLaunchingFinanceNumber] = useState<number | null>(null);
  const [launchingExpenseId, setLaunchingExpenseId] = useState<string | null>(null);
  const [launchAmount, setLaunchAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    persistStore(store);
  }, [store]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const finance = store.finances[0];
  const paidProgress = finance ? (finance.paidCount / finance.term) * 100 : 0;
  const remainingLoan = finance ? Math.max(0, finance.term - finance.paidCount) * finance.installment : 0;

  const totalDiscounts = useMemo(() => {
    return store.payments
      .filter((payment) => payment.kind === "finance")
      .reduce((sum, payment) => sum + payment.discount, 0);
  }, [store.payments]);

  const cardCommitment = useMemo(
    () =>
      store.cards.reduce((sum, card) => {
        const cycle = statementKey(new Date().toISOString().slice(0, 10), card.closingDay);
        const bill = store.expenses
          .filter((expense) => expense.cardId === card.id)
          .reduce((total, expense) => total + expenseAmountForStatement(expense, card.closingDay, cycle), 0);
        const paid = store.payments.find(
          (payment) => payment.kind === "bill" && payment.cardId === card.id && payment.statementKey === cycle
        );
        return sum + Math.max(0, bill - (paid?.paidAmount ?? 0));
      }, 0),
    [store.cards, store.expenses, store.payments]
  );

  const selectedCardData = store.cards.find((card) => card.id === selectedCard) ?? store.cards[0];
  const selectedCardExpenses = store.expenses.filter((expense) => expense.cardId === selectedCardData?.id);
  const selectedStatementKey = selectedCardData
    ? statementKey(new Date().toISOString().slice(0, 10), selectedCardData.closingDay)
    : "";
  const selectedCardGrossBill = selectedCardExpenses.reduce(
    (sum, expense) => sum + expenseAmountForStatement(expense, selectedCardData?.closingDay ?? 3, selectedStatementKey),
    0
  );
  const selectedCardBillPayment = store.payments.find(
    (payment) => payment.kind === "bill" && payment.cardId === selectedCardData?.id && payment.statementKey === selectedStatementKey
  );
  const selectedCardBill = Math.max(0, selectedCardGrossBill - (selectedCardBillPayment?.paidAmount ?? 0));
  const selectedCardStatus =
    selectedCardGrossBill <= 0 ? "aberta" : selectedCardBill <= 0 ? "paga" : selectedCardBillPayment ? "parcialmente paga" : "aberta";
  const selectedCardOutstanding = selectedCardData
    ? cardOutstandingAmount(selectedCardData, store.expenses, store.payments)
    : 0;
  const selectedCardUsed = Math.min(100, (selectedCardOutstanding / Math.max(1, selectedCardData?.limit ?? 1)) * 100);

  const nextDue = finance ? addMonths(finance.firstDue, finance.paidCount) : "2026-09-25";
  const nextInstallmentNumber = finance ? finance.paidCount + 1 : 1;

  const installments = useMemo(() => {
    if (!finance) return [];
    return Array.from({ length: finance.term }, (_, index) => {
      const number = index + 1;
      const due = addMonths(finance.firstDue, index);
      const isPaid = number <= finance.paidCount;
      const today = new Date().toISOString().slice(0, 10);
      return {
        number,
        due,
        status: isPaid ? "paid" : due < today ? "late" : number === finance.paidCount + 1 ? "next" : "open",
      } as const;
    });
  }, [finance]);

  const debtors = useMemo(() => {
    const grouped = new Map<string, number>();
    store.expenses.forEach((expense) => {
      const remaining =
        (expense.amount * Math.max(0, expense.installments - expense.installmentsPaid)) / expense.installments;
      grouped.set(expense.person, (grouped.get(expense.person) ?? 0) + remaining);
    });
    return Array.from(grouped.entries()).sort((a, b) => b[1] - a[1]);
  }, [store.expenses]);

  const reportMetrics = useMemo(() => {
    const totalExpenses = store.expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const totalPaid = store.payments.reduce((sum, pay) => sum + pay.paidAmount, 0);
    const totalDiscounts = store.payments.reduce((sum, pay) => sum + pay.discount, 0);
    
    const expensesByMonth = new Map<string, number>();
    store.expenses.forEach((expense) => {
      const month = expense.date.slice(0, 7);
      expensesByMonth.set(month, (expensesByMonth.get(month) ?? 0) + expense.amount);
    });
    
    const currentMonth = new Date().toISOString().slice(0, 7);
    const currentMonthExpenses = expensesByMonth.get(currentMonth) ?? 0;
    const previousMonth = addMonths(currentMonth + "-01", -1).slice(0, 7);
    const previousMonthExpenses = expensesByMonth.get(previousMonth) ?? 0;
    
    const averageMonthly = expensesByMonth.size > 0
      ? Array.from(expensesByMonth.values()).reduce((sum, val) => sum + val, 0) / expensesByMonth.size
      : 0;
    
    const expensesByCard = new Map<string, number>();
    store.expenses.forEach((expense) => {
      expensesByCard.set(expense.cardId, (expensesByCard.get(expense.cardId) ?? 0) + expense.amount);
    });
    
    const lateInstallments = installments.filter((inst) => inst.status === "late").length;
    const upcomingPayments = installments.filter((inst) => inst.status === "next" || inst.status === "open").length;
    
    return {
      totalExpenses,
      totalPaid,
      totalDiscounts,
      currentMonthExpenses,
      previousMonthExpenses,
      averageMonthly,
      expensesByCard,
      lateInstallments,
      upcomingPayments,
      expensesByMonth,
    };
  }, [store.expenses, store.payments, installments]);

  const updateFinance = (updater: (current: Finance) => Finance) => {
    setStore((current) => ({
      ...current,
      finances: current.finances.map((item) => (item.id === finance.id ? updater(item) : item)),
    }));
  };

  const registerPayment = () => {
    if (!finance || finance.paidCount >= finance.term) return;
    const nextStore = {
      ...store,
      finances: store.finances.map((item) =>
        item.id === finance.id ? { ...item, paidCount: item.paidCount + 1 } : item
      ),
    };
    persistStore(nextStore);
    setStore(nextStore);
    setToast(`Parcela ${nextInstallmentNumber} registrada como paga.`);
  };

  const registerFinanceInstallment = (number: number) => {
    if (!finance || number <= finance.paidCount || number > finance.term) return;
    const paid = Number(launchAmount.replace(",", ".")) || finance.installment;
    const discount = Math.max(0, finance.installment - paid);
    const entry: PaymentEntry = {
      id: `payment-${Date.now()}`,
      kind: "finance",
      referenceId: finance.id,
      label: `Parcela ${number}ª · ${finance.lender}`,
      installmentNumber: number,
      scheduledAmount: finance.installment,
      paidAmount: paid,
      discount,
      paidAt: paymentDate,
    };
    const nextStore = {
      ...store,
      finances: store.finances.map((item) => (item.id === finance.id ? { ...item, paidCount: number } : item)),
      payments: [entry, ...store.payments],
    };
    persistStore(nextStore);
    setStore(nextStore);
    setModal(null);
    setLaunchAmount("");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setLaunchingFinanceNumber(null);
    setToast(`Parcela ${number}ª lançada. Desconto: ${money(discount)}.`);
  };

  const payCardBill = () => {
    if (!selectedCardData || selectedCardGrossBill <= 0) return;
    const paid = Number(launchAmount.replace(",", ".")) || selectedCardBill;
    const discount = Math.max(0, selectedCardBill - paid);
    const entry: PaymentEntry = {
      id: `payment-${Date.now()}`,
      kind: "bill",
      referenceId: selectedCardData.id,
      cardId: selectedCardData.id,
      statementKey: selectedStatementKey,
      label: `Fatura ${selectedStatementKey} · ${selectedCardData.name}`,
      scheduledAmount: selectedCardBill,
      paidAmount: paid,
      discount,
      paidAt: paymentDate,
    };
    const nextStore = {
      ...store,
      payments: [
        entry,
        ...store.payments.filter(
          (payment) =>
            !(payment.kind === "bill" && payment.cardId === selectedCardData.id && payment.statementKey === selectedStatementKey)
        ),
      ],
    };
    persistStore(nextStore);
    setStore(nextStore);
    setModal(null);
    setLaunchAmount("");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setToast(`Fatura paga. Desconto: ${money(discount)}.`);
  };

  const registerCardInstallment = (id: string) => {
    const currentExpense = store.expenses.find((expense) => expense.id === id);
    if (!currentExpense || currentExpense.installmentsPaid >= currentExpense.installments) return;
    const scheduled = currentExpense.amount / currentExpense.installments;
    const paid = Number(launchAmount.replace(",", ".")) || scheduled;
    const discount = Math.max(0, scheduled - paid);
    const entry: PaymentEntry = {
      id: `payment-${Date.now()}`,
      kind: "card",
      referenceId: currentExpense.id,
      label: currentExpense.description,
      installmentNumber: currentExpense.installmentsPaid + 1,
      scheduledAmount: scheduled,
      paidAmount: paid,
      discount,
      paidAt: paymentDate,
    };
    const nextStore = {
      ...store,
      expenses: store.expenses.map((expense) =>
        expense.id === id ? { ...expense, installmentsPaid: expense.installmentsPaid + 1 } : expense
      ),
      payments: [entry, ...store.payments],
    };
    persistStore(nextStore);
    setStore(nextStore);
    setModal(null);
    setLaunchAmount("");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setLaunchingExpenseId(null);
    setToast(`${currentExpense.description}: parcela lançada. Desconto: ${money(discount)}.`);
  };

  const openExpenseEditor = (expense: Expense) => {
    setEditingExpenseId(expense.id);
    setExpenseForm({
      description: expense.description,
      person: expense.person,
      amount: String(expense.amount),
      installments: String(expense.installments),
      cardId: expense.cardId,
      date: expense.date,
    });
    setModal("editExpense");
  };

  const editExpense = (event: React.FormEvent) => {
    event.preventDefault();
    const amount = Number(expenseForm.amount.replace(",", "."));
    const installmentsCount = Math.max(1, Number(expenseForm.installments));
    if (!editingExpenseId || !expenseForm.description.trim() || !expenseForm.person.trim() || !amount) return;
    const nextStore = {
      ...store,
      expenses: store.expenses.map((expense) =>
        expense.id === editingExpenseId
          ? {
              ...expense,
              description: expenseForm.description.trim(),
              person: expenseForm.person.trim(),
              amount,
              installments: installmentsCount,
              cardId: expenseForm.cardId,
              date: expenseForm.date,
              installmentsPaid: Math.min(expense.installmentsPaid, installmentsCount),
            }
          : expense
      ),
    };
    persistStore(nextStore);
    setStore(nextStore);
    setSelectedCard(expenseForm.cardId);
    setEditingExpenseId(null);
    setModal(null);
    setToast("Despesa atualizada.");
  };

  const openCardEditor = (card: CardData) => {
    setEditingCardId(card.id);
    setCardForm({
      name: card.name,
      bank: card.bank,
      lastFour: card.lastFour,
      limit: String(card.limit),
      dueDay: String(card.dueDay),
      closingDay: String(card.closingDay),
    });
    setModal("editCard");
  };

  const editCard = (event: React.FormEvent) => {
    event.preventDefault();
    const limit = Number(cardForm.limit.replace(",", "."));
    const dueDay = Math.min(31, Math.max(1, Number(cardForm.dueDay) || 10));
    const closingDay = Math.min(31, Math.max(1, Number(cardForm.closingDay) || 3));
    if (!editingCardId || !cardForm.name.trim() || !cardForm.bank.trim() || !cardForm.lastFour || !limit) return;
    const nextStore = {
      ...store,
      cards: store.cards.map((card) =>
        card.id === editingCardId
          ? {
              ...card,
              name: cardForm.name.trim(),
              bank: cardForm.bank.trim(),
              lastFour: cardForm.lastFour.slice(-4),
              limit,
              dueDay,
              closingDay,
              color: cardColorForBank(`${cardForm.bank} ${cardForm.name}`),
            }
          : card
      ),
    };
    persistStore(nextStore);
    setStore(nextStore);
    setModal(null);
    setEditingCardId(null);
    setToast("Cartão atualizado.");
  };

  const deleteCard = (id: string) => {
    if (store.cards.length <= 1) {
      setToast("Mantenha pelo menos um cartão cadastrado.");
      return;
    }
    const nextStore = {
      ...store,
      cards: store.cards.filter((card) => card.id !== id),
      expenses: store.expenses.filter((expense) => expense.cardId !== id),
    };
    persistStore(nextStore);
    setStore(nextStore);
    setSelectedCard(nextStore.cards[0]?.id ?? "");
    setModal(null);
    setToast("Cartão e lançamentos vinculados excluídos.");
  };

  const confirmAnticipation = () => {
    if (!finance) return;
    const max = finance.term - finance.paidCount;
    const quantity = Math.min(max, Math.max(1, anticipationQty));
    updateFinance((current) => ({ ...current, paidCount: current.paidCount + quantity }));
    setModal(null);
    setToast(`${quantity} parcela${quantity > 1 ? "s" : ""} antecipada${quantity > 1 ? "s" : ""} com sucesso.`);
  };

  const addExpense = (event: React.FormEvent) => {
    event.preventDefault();
    const amount = Number(expenseForm.amount.replace(",", "."));
    const installmentsCount = Math.max(1, Number(expenseForm.installments));
    if (!expenseForm.description.trim() || !expenseForm.person.trim() || !amount || !expenseForm.cardId) return;
    const expense: Expense = {
      id: `expense-${Date.now()}`,
      cardId: expenseForm.cardId,
      description: expenseForm.description.trim(),
      person: expenseForm.person.trim(),
      amount,
      installments: installmentsCount,
      installmentsPaid: 0,
      date: new Date().toISOString().slice(0, 10),
    };
    const nextStore = { ...store, expenses: [expense, ...store.expenses] };
    persistStore(nextStore);
    setStore(nextStore);
    setSelectedCard(expense.cardId);
    setExpenseForm({
      description: "",
      person: "",
      amount: "",
      installments: "1",
      cardId: selectedCardData?.id ?? "",
      date: new Date().toISOString().slice(0, 10),
    });
    setModal(null);
    setToast("Despesa adicionada ao controle.");
  };

  const addCard = (event: React.FormEvent) => {
    event.preventDefault();
    const limit = Number(cardForm.limit.replace(",", "."));
    if (!cardForm.name.trim() || !cardForm.bank.trim() || !cardForm.lastFour || !limit) return;
    const card: CardData = {
      id: `card-${Date.now()}`,
      name: cardForm.name.trim(),
      bank: cardForm.bank.trim(),
      lastFour: cardForm.lastFour.slice(-4),
      limit,
      dueDay: Math.min(31, Math.max(1, Number(cardForm.dueDay) || 10)),
      closingDay: Math.min(31, Math.max(1, Number(cardForm.closingDay) || 3)),
      color: cardColorForBank(cardForm.bank),
    };
    setStore((current) => ({ ...current, cards: [...current.cards, card] }));
    setSelectedCard(card.id);
    setCardForm({ name: "", bank: "", lastFour: "", limit: "", dueDay: "10", closingDay: "3" });
    setModal(null);
    setToast("Cartão cadastrado.");
  };

  const deleteExpense = (id: string) => {
    const nextStore = { ...store, expenses: store.expenses.filter((expense) => expense.id !== id) };
    persistStore(nextStore);
    setStore(nextStore);
    setToast("Despesa removida.");
  };

  const exportBackup = () => {
    const payload = { app: "Finanwise Offline", version: 1, exportedAt: new Date().toISOString(), data: store };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `finanwise-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setModal(null);
    setToast("Backup salvo no seu dispositivo.");
  };

  const importBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const incoming = parsed.data ?? parsed;
        if (!incoming.finances || !incoming.cards || !incoming.expenses) throw new Error("invalid");
        const normalized = {
          ...incoming,
          cards: incoming.cards.map((card: CardData) => ({
            ...card,
            dueDay: card.dueDay ?? 10,
            closingDay: card.closingDay ?? 3,
          })),
        };
        setStore(normalized);
        setSelectedCard(normalized.cards[0]?.id ?? "");
        setToast("Backup restaurado com sucesso.");
      } catch {
        setToast("Não foi possível ler esse backup.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const resetData = () => {
    setStore(seedStore);
    setSelectedCard("");
    setToast("Dados de demonstração restaurados.");
  };

  const goTo = (tab: Tab) => setActiveTab(tab);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <Sparkles size={16} strokeWidth={2.4} />
          </div>
          <div>
            <span className="brand-name">finanwise</span>
            <span className="brand-caption">offline</span>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="offline-pill">
            <span className="status-dot" />
            local
          </span>
          <IconButton label="Notificações">
            <Bell size={19} />
          </IconButton>
          <IconButton label="Backup dos dados" onClick={() => setModal("backup")}>
            <MoreHorizontal size={20} />
          </IconButton>
        </div>
      </header>

      <main className="main-content">
        <section className="welcome-row">
          <div>
            <p className="eyebrow">terça-feira, 15 de setembro</p>
            <h1>
              Olá, Josenildo <span className="wave">✦</span>
            </h1>
            <p className="subtitle">Uma visão tranquila do que importa hoje.</p>
          </div>
          <div className="avatar">JS</div>
        </section>

        {activeTab === "overview" && (
          <>
            <section className="hero-balance card-surface">
              <div className="balance-copy">
                <div className="balance-label">
                  <span className="mini-icon violet">
                    <WalletCards size={15} />
                  </span>
                  compromissos em aberto <span className="info-dot">i</span>
                </div>
                <div className="balance-value">{money(remainingLoan + cardCommitment)}</div>
                <div className="balance-meta">
                  <TrendingUp size={15} /> acompanhamento local atualizado
                </div>
              </div>
              <div className="balance-orbit">
                <CircleDollarSign size={94} strokeWidth={1.2} />
              </div>
              <div className="balance-footer">
                <span>financiamento</span>
                <strong>{money(remainingLoan)}</strong>
                <span className="divider-dot" />
                <span>cartões este mês</span>
                <strong>{money(cardCommitment)}</strong>
              </div>
            </section>

            <div className="section-heading">
              <div>
                <p className="eyebrow">acesso rápido</p>
                <h2>O que você precisa?</h2>
              </div>
              <button className="text-button" onClick={() => setModal("backup")}>
                gerenciar dados <ChevronRight size={16} />
              </button>
            </div>

            <div className="quick-actions">
              <button className="quick-card lilac" onClick={() => goTo("finances")}>
                <span className="quick-icon">
                  <Landmark size={20} />
                </span>
                <span>Ver financiamento</span>
                <ChevronRight size={16} />
              </button>
              <button
                className="quick-card mint"
                onClick={() => {
                  setExpenseForm((form) => ({ ...form, cardId: selectedCardData?.id ?? "nubank" }));
                  setModal("expense");
                }}
              >
                <span className="quick-icon">
                  <ReceiptText size={20} />
                </span>
                <span>Lançar despesa</span>
                <Plus size={16} />
              </button>
              <button className="quick-card peach" onClick={() => goTo("reports")}>
                <span className="quick-icon">
                  <UsersRound size={20} />
                </span>
                <span>Ver devedores</span>
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="section-heading compact">
              <div>
                <p className="eyebrow">próximo compromisso</p>
                <h2>Não deixe passar</h2>
              </div>
              <button className="circle-link" onClick={() => goTo("finances")}>
                <ChevronRight size={18} />
              </button>
            </div>

            <section className="next-payment card-surface">
              <div className="next-payment-main">
                <div className="payment-icon">
                  <CarFront size={22} />
                </div>
                <div>
                  <strong>Financiamento {finance?.lender}</strong>
                  <span>
                    {nextInstallmentNumber}ª de {finance?.term} parcelas · vence {dateLabel(nextDue)}
                  </span>
                </div>
              </div>
              <div className="next-payment-value">
                <strong>{money(finance?.installment ?? 0)}</strong>
                <span className="status-chip amber">em aberto</span>
              </div>
            </section>

            <div className="section-heading compact">
              <div>
                <p className="eyebrow">seus números</p>
                <h2>De relance</h2>
              </div>
              <button className="text-button" onClick={() => goTo("reports")}>
                relatórios <ChevronRight size={16} />
              </button>
            </div>

            <div className="metric-grid">
              <article className="metric-card card-surface">
                <span className="metric-icon blue">
                  <HandCoins size={19} />
                </span>
                <div>
                  <span className="metric-label">parcelas pagas</span>
                  <strong>
                    {finance?.paidCount ?? 0} <small>/ {finance?.term ?? 0}</small>
                  </strong>
                </div>
                <ProgressBar value={paidProgress} />
              </article>
              <article className="metric-card card-surface">
                <span className="metric-icon coral">
                  <CreditCard size={19} />
                </span>
                <div>
                  <span className="metric-label">fatura atual</span>
                  <strong>{money(cardCommitment)}</strong>
                </div>
                <span className="metric-foot">{store.expenses.length} despesas lançadas</span>
              </article>
            </div>
          </>
        )}

        {activeTab === "finances" && (
          <section className="page-section">
            <div className="page-title-row">
              <div>
                <p className="eyebrow">módulo 01</p>
                <h1>Financiamentos</h1>
                <p className="subtitle">Acompanhe o contrato e antecipe quando quiser.</p>
              </div>
              <button className="primary-button" onClick={() => setModal("anticipate")}>
                <ArrowUpRight size={17} /> antecipar
              </button>
            </div>

            <section className="finance-hero card-surface">
              <div className="finance-brand">
                <div className="bank-icon">
                  <Landmark size={21} />
                </div>
                <div>
                  <strong>{finance?.lender}</strong>
                  <span>Contrato {finance?.contract}</span>
                </div>
                <span className="status-chip green">
                  <ShieldCheck size={13} /> em dia
                </span>
              </div>

              <div className="finance-asset">
                <CarFront size={21} />
                <div>
                  <span>veículo financiado</span>
                  <strong>{finance?.vehicle}</strong>
                  <small>placa {finance?.plate}</small>
                </div>
              </div>

              <div className="finance-balance">
                <div>
                  <span className="metric-label">saldo projetado</span>
                  <strong>{money(remainingLoan)}</strong>
                </div>
                <div className="balance-side">
                  <span>já pago</span>
                  <strong>{money((finance?.paidCount ?? 0) * (finance?.installment ?? 0))}</strong>
                </div>
              </div>

              <ProgressBar value={paidProgress} tone="green" />
              <div className="finance-progress-labels">
                <span>{finance?.paidCount} parcelas pagas</span>
                <span>{finance?.term - (finance?.paidCount ?? 0)} restantes</span>
              </div>

              <div className="finance-details">
                <div>
                  <span>Descontos</span>
                  <strong style={{ color: "#4d936e" }}>{money(totalDiscounts)}</strong>
                </div>
                <div>
                  <span>juros a.m.</span>
                  <strong>{finance?.monthlyRate.toFixed(2).replace(".", ",")} %</strong>
                </div>
                <div>
                  <span>CET a.m.</span>
                  <strong>{finance?.cet.toFixed(2).replace(".", ",")} %</strong>
                </div>
              </div>
            </section>

            <div className="action-row">
              <button className="secondary-button" onClick={registerPayment}>
                <Check size={16} /> registrar pagamento
              </button>
              <button className="secondary-button" onClick={() => setModal("anticipate")}>
                <ArrowUpRight size={16} /> antecipar parcelas
              </button>
            </div>

            <div className="section-heading compact">
              <div>
                <p className="eyebrow">linha do tempo</p>
                <h2>Parcelas do contrato</h2>
              </div>
              <span className="muted-count">{finance?.term} no total</span>
            </div>

            <div className="installment-list card-surface">
              {installments
                .slice(Math.max(0, (finance?.paidCount ?? 0) - 2), Math.min(12, (finance?.paidCount ?? 0) + 6))
                .map((item) => (
                  <div className={`installment-row ${item.status}`} key={item.number}>
                    <div className="installment-status">
                      {item.status === "paid" ? (
                        <Check size={15} />
                      ) : item.status === "next" ? (
                        <span className="current-dot" />
                      ) : (
                        <CalendarDays size={15} />
                      )}
                    </div>
                    <div className="installment-name">
                      <strong>{item.number}ª parcela</strong>
                      <span>vencimento {dateLabel(item.due, "full")}</span>
                    </div>
                    <span
                      className={`status-chip ${
                        item.status === "paid"
                          ? "green"
                          : item.status === "next"
                          ? "amber"
                          : item.status === "late"
                          ? "red"
                          : "soft"
                      }`}
                    >
                      {item.status === "paid"
                        ? "paga"
                        : item.status === "next"
                        ? "próxima"
                        : item.status === "late"
                        ? "atrasada"
                        : "em aberto"}
                    </span>
                    <strong className="installment-amount">{money(finance?.installment ?? 0)}</strong>
                    {item.status !== "paid" && (
                      <button
                        className="row-action"
                        onClick={() => {
                          setLaunchingFinanceNumber(item.number);
                          setLaunchAmount(String(finance?.installment ?? ""));
                          setModal("launchFinance");
                        }}
                      >
                        lançar
                      </button>
                    )}
                  </div>
                ))}
            </div>

            <div className="section-heading compact">
              <div>
                <p className="eyebrow">histórico detalhado</p>
                <h2>Pagamentos do financiamento</h2>
              </div>
              <span className="muted-count">
                {store.payments.filter((payment) => payment.kind === "finance").length} lançamentos
              </span>
            </div>

            <div className="history-list card-surface">
              {store.payments
                .filter((payment) => payment.kind === "finance")
                .slice(0, 8)
                .map((payment) => (
                  <div className="history-row" key={payment.id}>
                    <div className="history-icon">
                      <Check size={15} />
                    </div>
                    <div className="history-copy">
                      <strong>{payment.label}</strong>
                      <span>pago em {dateLabel(payment.paidAt, "full")}</span>
                    </div>
                    <div className="history-values">
                      <strong>{money(payment.paidAmount)}</strong>
                      <span>{payment.discount > 0 ? `desconto ${money(payment.discount)}` : "sem desconto"}</span>
                    </div>
                  </div>
                ))}
              {store.payments.filter((payment) => payment.kind === "finance").length === 0 && (
                <div className="empty-state">
                  <HandCoins size={25} />
                  <strong>Nenhum pagamento lançado manualmente</strong>
                  <span>O histórico aparecerá quando você lançar uma parcela.</span>
                </div>
              )}
            </div>

            <p className="privacy-note">
              <LockKeyhole size={14} /> Seus dados ficam somente neste dispositivo.
            </p>
          </section>
        )}

        {activeTab === "cards" && (
          <section className="page-section">
            <div className="page-title-row">
              <div>
                <p className="eyebrow">módulo 02</p>
                <h1>Cartões</h1>
                <p className="subtitle">Limites, compras e quem precisa acertar.</p>
              </div>
              <button className="primary-button" onClick={() => setModal("card")}>
                <Plus size={17} /> novo cartão
              </button>
            </div>

            <div className="cards-scroller">
              {store.cards.length === 0 ? (
                <div className="empty-state card-empty">
                  <CreditCard size={26} />
                  <strong>Nenhum cartão cadastrado</strong>
                  <span>Cadastre um cartão para começar a controlar suas faturas.</span>
                </div>
              ) : (
                store.cards.map((card) => {
                  const cycle = statementKey(new Date().toISOString().slice(0, 10), card.closingDay);
                  const outstanding = cardOutstandingAmount(card, store.expenses, store.payments);
                  const detectedColor = cardColorForBank(`${card.bank} ${card.name}`);
                  return (
                    <button
                      key={card.id}
                      className={`credit-card ${detectedColor} ${selectedCard === card.id ? "selected" : ""}`}
                      onClick={() => setSelectedCard(card.id)}
                    >
                      <div className="credit-card-top">
                        <span>{card.bank}</span>
                        <CreditCard size={20} />
                      </div>
                      <div className="credit-card-number">••••  ••••  ••••  {card.lastFour}</div>
                      <div className="credit-card-bottom">
                        <div>
                          <small>limite disponível</small>
                          <strong>{money(card.limit - outstanding)}</strong>
                        </div>
                        <div className="card-holder">{card.name}</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {selectedCardData && (
              <section className="card-overview card-surface">
                <div className="card-overview-title">
                  <div>
                    <p className="eyebrow">cartão selecionado</p>
                    <h2>{selectedCardData.name}</h2>
                  </div>
                  <span
                    className={`status-chip ${
                      selectedCardStatus === "paga"
                        ? "green"
                        : selectedCardStatus === "parcialmente paga"
                        ? "amber"
                        : "soft"
                    }`}
                  >
                    {selectedCardStatus}
                  </span>
                </div>

                <div className="card-spend">
                  <div>
                    <span>fatura projetada</span>
                    <strong>{money(selectedCardBill)}</strong>
                  </div>
                  <div>
                    <span>limite total</span>
                    <strong>{money(selectedCardData.limit)}</strong>
                  </div>
                </div>

                <ProgressBar value={selectedCardUsed} tone="coral" />
                <div className="finance-progress-labels">
                  <span>{Math.round(selectedCardUsed)}% utilizado</span>
                  <span>disponível {money(selectedCardData.limit - selectedCardOutstanding)}</span>
                </div>

                <div className="card-dates">
                  <span>
                    fecha dia <strong>{selectedCardData.closingDay}</strong>
                  </span>
                  <span>
                    vence dia <strong>{selectedCardData.dueDay}</strong>
                  </span>
                </div>

                <div className="card-management">
                  <button
                    className="primary-button small"
                    onClick={() => {
                      setLaunchAmount(String(selectedCardBill));
                      setModal("payBill");
                    }}
                  >
                    <Check size={14} /> pagar fatura
                  </button>
                  <button className="text-button" onClick={() => openCardEditor(selectedCardData)}>
                    <BriefcaseBusiness size={14} /> editar cartão
                  </button>
                  <button className="text-button danger-text" onClick={() => deleteCard(selectedCardData.id)}>
                    <Trash2 size={14} /> excluir cartão
                  </button>
                </div>
              </section>
            )}

            <div className="section-heading compact">
              <div>
                <p className="eyebrow">lançamentos</p>
                <h2>Despesas do cartão</h2>
              </div>
              <button
                className="secondary-button small"
                onClick={() => {
                  setExpenseForm((form) => ({ ...form, cardId: selectedCardData?.id ?? "nubank" }));
                  setModal("expense");
                }}
              >
                <Plus size={15} /> lançar
              </button>
            </div>

            <div className="expense-list card-surface">
              {selectedCardExpenses.length === 0 ? (
                <div className="empty-state">
                  <ReceiptText size={26} />
                  <strong>Nenhuma despesa ainda</strong>
                  <span>Comece lançando uma compra deste cartão.</span>
                </div>
              ) : (
                selectedCardExpenses.map((expense) => (
                  <div className="expense-row" key={expense.id}>
                    <div className="expense-icon">
                      <ReceiptText size={17} />
                    </div>
                    <div className="expense-copy">
                      <strong>{expense.description}</strong>
                      <span>
                        {expense.person} ·{" "}
                        {expense.installments > 1
                          ? `${expense.installmentsPaid}/${expense.installments} parcelas lançadas`
                          : expense.installmentsPaid
                          ? "paga"
                          : dateLabel(expense.date)}
                      </span>
                    </div>
                    <div className="expense-value">
                      <strong>{money(expense.amount / expense.installments)}</strong>
                      <span>{expense.installments > 1 ? `de ${money(expense.amount)}` : "à vista"}</span>
                    </div>
                    {expense.installmentsPaid < expense.installments && (
                      <button
                        className="row-action"
                        onClick={() => {
                          setLaunchingExpenseId(expense.id);
                          setLaunchAmount(String(expense.amount / expense.installments));
                          setModal("launchCard");
                        }}
                      >
                        lançar
                      </button>
                    )}
                    <IconButton label="Editar despesa" onClick={() => openExpenseEditor(expense)}>
                      <BriefcaseBusiness size={15} />
                    </IconButton>
                    <IconButton label="Remover despesa" onClick={() => deleteExpense(expense.id)}>
                      <Trash2 size={15} />
                    </IconButton>
                  </div>
                ))
              )}
            </div>

            <div className="section-heading compact">
              <div>
                <p className="eyebrow">histórico detalhado</p>
                <h2>Pagamentos dos cartões</h2>
              </div>
              <span className="muted-count">
                {store.payments.filter((payment) => payment.kind === "card" || payment.kind === "bill").length}{" "}
                lançamentos
              </span>
            </div>

            <div className="history-list card-surface">
              {store.payments
                .filter((payment) => payment.kind === "card" || payment.kind === "bill")
                .slice(0, 8)
                .map((payment) => (
                  <div className="history-row" key={payment.id}>
                    <div className="history-icon coral">
                      <Check size={15} />
                    </div>
                    <div className="history-copy">
                      <strong>
                        {payment.kind === "bill" ? payment.label : `${payment.label} · ${payment.installmentNumber}ª`}
                      </strong>
                      <span>pago em {dateLabel(payment.paidAt, "full")}</span>
                    </div>
                    <div className="history-values">
                      <strong>{money(payment.paidAmount)}</strong>
                      <span>{payment.discount > 0 ? `desconto ${money(payment.discount)}` : "sem desconto"}</span>
                    </div>
                  </div>
                ))}
              {store.payments.filter((payment) => payment.kind === "card" || payment.kind === "bill").length === 0 && (
                <div className="empty-state">
                  <CreditCard size={25} />
                  <strong>Nenhum pagamento lançado manualmente</strong>
                  <span>O histórico aparecerá quando você lançar uma parcela.</span>
                </div>
              )}
            </div>

            <p className="privacy-note">
              <LockKeyhole size={14} /> Compras e cartões são salvos localmente, sem internet.
            </p>
          </section>
        )}

        {activeTab === "reports" && (
          <section className="page-section">
            <div className="page-title-row">
              <div>
                <p className="eyebrow">visão analítica</p>
                <h1>Relatórios</h1>
                <p className="subtitle">Análise completa das suas finanças.</p>
              </div>
              <button className="secondary-button" onClick={exportBackup}>
                <FileDown size={16} /> exportar
              </button>
            </div>

            <div className="report-highlight card-surface">
              <div className="report-highlight-icon">
                <UsersRound size={23} />
              </div>
              <div>
                <span>total a receber</span>
                <strong>{money(debtors.reduce((sum, [, value]) => sum + value, 0))}</strong>
                <small>considerando parcelas futuras</small>
              </div>
              <ArrowUpRight size={20} />
            </div>

            <div className="report-metrics">
              <div className="report-mini card-surface">
                <span className="metric-icon blue">
                  <CreditCard size={17} />
                </span>
                <span>cartões ativos</span>
                <strong>{store.cards.length}</strong>
              </div>
              <div className="report-mini card-surface">
                <span className="metric-icon coral">
                  <ReceiptText size={17} />
                </span>
                <span>despesas lançadas</span>
                <strong>{store.expenses.length}</strong>
              </div>
              <div className="report-mini card-surface">
                <span className="metric-icon blue">
                  <TrendingDown size={17} />
                </span>
                <span>total gasto</span>
                <strong>{money(reportMetrics.totalExpenses)}</strong>
              </div>
              <div className="report-mini card-surface">
                <span className="metric-icon coral">
                  <HandCoins size={17} />
                </span>
                <span>total pago</span>
                <strong>{money(reportMetrics.totalPaid)}</strong>
              </div>
              <div className="report-mini card-surface">
                <span className="metric-icon blue">
                  <Sparkles size={17} />
                </span>
                <span>economizado</span>
                <strong style={{ color: "#4d936e" }}>{money(reportMetrics.totalDiscounts)}</strong>
              </div>
              <div className="report-mini card-surface">
                <span className="metric-icon coral">
                  <CalendarDays size={17} />
                </span>
                <span>média mensal</span>
                <strong>{money(reportMetrics.averageMonthly)}</strong>
              </div>
            </div>

            <div className="section-heading compact">
              <div>
                <p className="eyebrow">análise mensal</p>
                <h2>Comparativo</h2>
              </div>
            </div>

            <div className="metric-grid">
              <article className="metric-card card-surface">
                <span className="metric-icon blue">
                  <TrendingUp size={19} />
                </span>
                <div>
                  <span className="metric-label">mês atual</span>
                  <strong>{money(reportMetrics.currentMonthExpenses)}</strong>
                </div>
                <span className="metric-foot">
                  {reportMetrics.currentMonthExpenses > reportMetrics.previousMonthExpenses
                    ? `+${money(
                        reportMetrics.currentMonthExpenses - reportMetrics.previousMonthExpenses
                      )} vs mês anterior`
                    : `-${money(
                        reportMetrics.previousMonthExpenses - reportMetrics.currentMonthExpenses
                      )} vs mês anterior`}
                </span>
              </article>
              <article className="metric-card card-surface">
                <span className="metric-icon coral">
                  <CalendarDays size={19} />
                </span>
                <div>
                  <span className="metric-label">mês anterior</span>
                  <strong>{money(reportMetrics.previousMonthExpenses)}</strong>
                </div>
                <span className="metric-foot">gastos totais</span>
              </article>
            </div>

            <div className="section-heading compact">
              <div>
                <p className="eyebrow">status de pagamentos</p>
                <h2>Financiamento</h2>
              </div>
            </div>

            <div className="metric-grid">
              <article className="metric-card card-surface">
                <span className="metric-icon blue">
                  <Check size={19} />
                </span>
                <div>
                  <span className="metric-label">parcelas em dia</span>
                  <strong>{finance?.paidCount ?? 0}</strong>
                </div>
                <ProgressBar value={paidProgress} tone="green" />
              </article>
              <article className="metric-card card-surface">
                <span className="metric-icon coral">
                  <CalendarDays size={19} />
                </span>
                <div>
                  <span className="metric-label">próximos pagamentos</span>
                  <strong>{reportMetrics.upcomingPayments}</strong>
                </div>
                <span className="metric-foot">parcelas restantes</span>
              </article>
            </div>

            {reportMetrics.lateInstallments > 0 && (
              <div className="insight-banner" style={{ background: "#f9e5e1", borderColor: "#e8b4a8", color: "#bd6257" }}>
                <CalendarDays size={19} />
                <div>
                  <strong style={{ color: "#bd6257" }}>Atenção</strong>
                  <span style={{ color: "#bd6257" }}>
                    Você tem {reportMetrics.lateInstallments} parcela{reportMetrics.lateInstallments > 1 ? "s" : ""}{" "}
                    atrasada{reportMetrics.lateInstallments > 1 ? "s" : ""}.
                  </span>
                </div>
              </div>
            )}

            <div className="section-heading compact">
              <div>
                <p className="eyebrow">por pessoa</p>
                <h2>Relatório de devedores</h2>
              </div>
              <span className="muted-count">{debtors.length} pessoas</span>
            </div>

            <div className="debtor-list card-surface">
              {debtors.length === 0 ? (
                <div className="empty-state">
                  <UsersRound size={26} />
                  <strong>Nenhum devedor cadastrado</strong>
                  <span>As pessoas que devem aparecerão aqui.</span>
                </div>
              ) : (
                debtors.map(([person, value], index) => {
                  const total = debtors.reduce((sum, [, amount]) => sum + amount, 0);
                  return (
                    <div className="debtor-row" key={person}>
                      <div className={`person-avatar avatar-${index % 4}`}>
                        {person
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)}
                      </div>
                      <div className="debtor-copy">
                        <strong>{person}</strong>
                        <span>{store.expenses.filter((expense) => expense.person === person).length} despesas vinculadas</span>
                        <ProgressBar value={total ? (value / total) * 100 : 0} tone={index === 0 ? "coral" : "blue"} />
                      </div>
                      <div className="debtor-value">
                        <strong>{money(value)}</strong>
                        <span>a receber</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {store.cards.length > 0 && (
              <>
                <div className="section-heading compact">
                  <div>
                    <p className="eyebrow">por cartão</p>
                    <h2>Gastos por cartão</h2>
                  </div>
                </div>

                <div className="debtor-list card-surface">
                  {store.cards.map((card, index) => {
                    const cardTotal = reportMetrics.expensesByCard.get(card.id) ?? 0;
                    const maxCardTotal = Math.max(...Array.from(reportMetrics.expensesByCard.values()), 1);
                    return (
                      <div className="debtor-row" key={card.id}>
                        <div className={`person-avatar avatar-${index % 4}`}>
                          <CreditCard size={16} />
                        </div>
                        <div className="debtor-copy">
                          <strong>{card.name}</strong>
                          <span>
                            {card.bank} · {card.lastFour}
                          </span>
                          <ProgressBar value={(cardTotal / maxCardTotal) * 100} tone="blue" />
                        </div>
                        <div className="debtor-value">
                          <strong>{money(cardTotal)}</strong>
                          <span>total gasto</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <div className="insight-banner">
              <Sparkles size={19} />
              <div>
                <strong>Uma boa prática</strong>
                <span>registre quem fez a compra para nunca perder a conta no fim do mês.</span>
              </div>
            </div>
          </section>
        )}
      </main>

      <nav className="bottom-nav" aria-label="Navegação principal">
        <button className={activeTab === "overview" ? "active" : ""} onClick={() => goTo("overview")}>
          <LayoutGrid size={20} />
          <span>Visão geral</span>
        </button>
        <button className={activeTab === "finances" ? "active" : ""} onClick={() => goTo("finances")}>
          <Landmark size={20} />
          <span>Financiamento</span>
        </button>
        <button className={activeTab === "cards" ? "active" : ""} onClick={() => goTo("cards")}>
          <CreditCard size={20} />
          <span>Cartões</span>
        </button>
        <button className={activeTab === "reports" ? "active" : ""} onClick={() => goTo("reports")}>
          <BarChart3 size={20} />
          <span>Relatórios</span>
        </button>
      </nav>

      {modal === "expense" && (
        <ModalShell title="Nova despesa" eyebrow="cartões de crédito" onClose={() => setModal(null)}>
          <form className="form-stack" onSubmit={addExpense}>
            <label>
              Descrição
              <input
                autoFocus
                value={expenseForm.description}
                onChange={(event) => setExpenseForm({ ...expenseForm, description: event.target.value })}
                placeholder="Ex.: supermercado"
              />
            </label>
            <label>
              Quem vai pagar?
              <input
                value={expenseForm.person}
                onChange={(event) => setExpenseForm({ ...expenseForm, person: event.target.value })}
                placeholder="Nome da pessoa"
              />
            </label>
            <label>
              Data da despesa
              <input
                type="date"
                value={expenseForm.date}
                onChange={(event) => setExpenseForm({ ...expenseForm, date: event.target.value })}
              />
            </label>
            <div className="form-grid">
              <label>
                Valor total
                <input
                  inputMode="decimal"
                  value={expenseForm.amount}
                  onChange={(event) => setExpenseForm({ ...expenseForm, amount: event.target.value })}
                  placeholder="0,00"
                />
              </label>
              <label>
                Parcelas
                <input
                  type="number"
                  min="1"
                  max="48"
                  value={expenseForm.installments}
                  onChange={(event) => setExpenseForm({ ...expenseForm, installments: event.target.value })}
                />
              </label>
            </div>
            <label>
              Cartão
              <select
                value={expenseForm.cardId}
                onChange={(event) => setExpenseForm({ ...expenseForm, cardId: event.target.value })}
              >
                {store.cards.map((card) => (
                  <option value={card.id} key={card.id}>
                    {card.name} · {card.lastFour}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button full" type="submit">
              <Check size={17} /> salvar despesa
            </button>
          </form>
        </ModalShell>
      )}

      {modal === "editExpense" && (
        <ModalShell title="Editar despesa" eyebrow="lançamento do cartão" onClose={() => setModal(null)}>
          <form className="form-stack" onSubmit={editExpense}>
            <label>
              Descrição
              <input
                autoFocus
                value={expenseForm.description}
                onChange={(event) => setExpenseForm({ ...expenseForm, description: event.target.value })}
              />
            </label>
            <label>
              Quem vai pagar?
              <input
                value={expenseForm.person}
                onChange={(event) => setExpenseForm({ ...expenseForm, person: event.target.value })}
              />
            </label>
            <div className="form-grid">
              <label>
                Valor total
                <input
                  inputMode="decimal"
                  value={expenseForm.amount}
                  onChange={(event) => setExpenseForm({ ...expenseForm, amount: event.target.value })}
                />
              </label>
              <label>
                Parcelas
                <input
                  type="number"
                  min="1"
                  max="48"
                  value={expenseForm.installments}
                  onChange={(event) => setExpenseForm({ ...expenseForm, installments: event.target.value })}
                />
              </label>
            </div>
            <label>
              Cartão
              <select
                value={expenseForm.cardId}
                onChange={(event) => setExpenseForm({ ...expenseForm, cardId: event.target.value })}
              >
                {store.cards.map((card) => (
                  <option value={card.id} key={card.id}>
                    {card.name} · {card.lastFour}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button full" type="submit">
              <Check size={17} /> salvar alterações
            </button>
          </form>
        </ModalShell>
      )}

      {modal === "editCard" && editingCardId && (
        <ModalShell title="Editar cartão" eyebrow="carteira digital" onClose={() => setModal(null)}>
          <form className="form-stack" onSubmit={editCard}>
            <label>
              Nome do cartão
              <input
                autoFocus
                value={cardForm.name}
                onChange={(event) => setCardForm({ ...cardForm, name: event.target.value })}
              />
            </label>
            <label>
              Banco ou emissor
              <input
                value={cardForm.bank}
                onChange={(event) => setCardForm({ ...cardForm, bank: event.target.value })}
              />
            </label>
            <div className="form-grid">
              <label>
                Últimos 4 dígitos
                <input
                  inputMode="numeric"
                  maxLength={4}
                  value={cardForm.lastFour}
                  onChange={(event) => setCardForm({ ...cardForm, lastFour: event.target.value.replace(/\D/g, "") })}
                />
              </label>
              <label>
                Limite total
                <input
                  inputMode="decimal"
                  value={cardForm.limit}
                  onChange={(event) => setCardForm({ ...cardForm, limit: event.target.value })}
                />
              </label>
            </div>
            <div className="form-grid">
              <label>
                Vencimento
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={cardForm.dueDay}
                  onChange={(event) => setCardForm({ ...cardForm, dueDay: event.target.value })}
                />
              </label>
              <label>
                Fechamento
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={cardForm.closingDay}
                  onChange={(event) => setCardForm({ ...cardForm, closingDay: event.target.value })}
                />
              </label>
            </div>
            <button className="primary-button full" type="submit">
              <Check size={17} /> salvar cartão
            </button>
            <button
              className="text-button danger-text full-danger"
              type="button"
              onClick={() => deleteCard(editingCardId)}
            >
              <Trash2 size={15} /> excluir cartão e lançamentos
            </button>
          </form>
        </ModalShell>
      )}

      {modal === "card" && (
        <ModalShell title="Novo cartão" eyebrow="carteira digital" onClose={() => setModal(null)}>
          <form className="form-stack" onSubmit={addCard}>
            <label>
              Nome do cartão
              <input
                autoFocus
                value={cardForm.name}
                onChange={(event) => setCardForm({ ...cardForm, name: event.target.value })}
                placeholder="Ex.: Visa Infinite"
              />
            </label>
            <label>
              Banco ou emissor
              <input
                value={cardForm.bank}
                onChange={(event) => setCardForm({ ...cardForm, bank: event.target.value })}
                placeholder="Ex.: Inter"
              />
            </label>
            <div className="form-grid">
              <label>
                Últimos 4 dígitos
                <input
                  inputMode="numeric"
                  maxLength={4}
                  value={cardForm.lastFour}
                  onChange={(event) => setCardForm({ ...cardForm, lastFour: event.target.value.replace(/\D/g, "") })}
                  placeholder="0000"
                />
              </label>
              <label>
                Limite total
                <input
                  inputMode="decimal"
                  value={cardForm.limit}
                  onChange={(event) => setCardForm({ ...cardForm, limit: event.target.value })}
                  placeholder="0,00"
                />
              </label>
            </div>
            <div className="form-grid">
              <label>
                Vencimento
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={cardForm.dueDay}
                  onChange={(event) => setCardForm({ ...cardForm, dueDay: event.target.value })}
                />
              </label>
              <label>
                Fechamento
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={cardForm.closingDay}
                  onChange={(event) => setCardForm({ ...cardForm, closingDay: event.target.value })}
                />
              </label>
            </div>
            <button className="primary-button full" type="submit">
              <Plus size={17} /> cadastrar cartão
            </button>
          </form>
        </ModalShell>
      )}

      {modal === "launchFinance" && launchingFinanceNumber && (
        <ModalShell
          title={`Lançar ${launchingFinanceNumber}ª parcela`}
          eyebrow="pagamento manual do financiamento"
          onClose={() => setModal(null)}
        >
          <div className="launch-context">
            <CalendarDays size={18} />
            <span>
              Valor previsto da parcela: <strong>{money(finance?.installment ?? 0)}</strong>
            </span>
          </div>
          <form
            className="form-stack"
            onSubmit={(event) => {
              event.preventDefault();
              registerFinanceInstallment(launchingFinanceNumber);
            }}
          >
            <label>
              Valor pago
              <input
                autoFocus
                inputMode="decimal"
                value={launchAmount}
                onChange={(event) => setLaunchAmount(event.target.value)}
              />
            </label>
            <label>
              Data real do pagamento
              <input
                type="date"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
              />
            </label>
            <div className="discount-preview">
              <span>desconto aplicado</span>
              <strong>
                {money(
                  Math.max(0, (finance?.installment ?? 0) - (Number(launchAmount.replace(",", ".")) || 0))
                )}
              </strong>
            </div>
            <button className="primary-button full" type="submit">
              <Check size={17} /> confirmar lançamento
            </button>
          </form>
        </ModalShell>
      )}

      {modal === "launchCard" &&
        launchingExpenseId &&
        (() => {
          const launchExpense = store.expenses.find((expense) => expense.id === launchingExpenseId);
          const scheduled = launchExpense ? launchExpense.amount / launchExpense.installments : 0;
          const paid = Number(launchAmount.replace(",", ".")) || 0;
          return (
            <ModalShell
              title="Lançar parcela do cartão"
              eyebrow={launchExpense?.description ?? "despesa"}
              onClose={() => setModal(null)}
            >
              <div className="launch-context">
                <ReceiptText size={18} />
                <span>
                  Parcela prevista: <strong>{money(scheduled)}</strong>
                </span>
              </div>
              <form
                className="form-stack"
                onSubmit={(event) => {
                  event.preventDefault();
                  registerCardInstallment(launchingExpenseId);
                }}
              >
                <label>
                  Valor pago
                  <input
                    autoFocus
                    inputMode="decimal"
                    value={launchAmount}
                    onChange={(event) => setLaunchAmount(event.target.value)}
                  />
                </label>
                <label>
                  Data real do pagamento
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(event) => setPaymentDate(event.target.value)}
                  />
                </label>
                <div className="discount-preview">
                  <span>desconto aplicado</span>
                  <strong>{money(Math.max(0, scheduled - paid))}</strong>
                </div>
                <button className="primary-button full" type="submit">
                  <Check size={17} /> confirmar lançamento
                </button>
              </form>
            </ModalShell>
          );
        })()}

      {modal === "payBill" && selectedCardData && (
        <ModalShell
          title="Pagar fatura"
          eyebrow={`${selectedCardData.name} · final ${selectedCardData.lastFour}`}
          onClose={() => setModal(null)}
        >
          <div className="launch-context">
            <CreditCard size={18} />
            <span>
              Saldo atual da fatura: <strong>{money(selectedCardBill)}</strong>
            </span>
          </div>
          <form
            className="form-stack"
            onSubmit={(event) => {
              event.preventDefault();
              payCardBill();
            }}
          >
            <label>
              Valor pago
              <input
                autoFocus
                inputMode="decimal"
                value={launchAmount}
                onChange={(event) => setLaunchAmount(event.target.value)}
              />
            </label>
            <label>
              Data real do pagamento
              <input
                type="date"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
              />
            </label>
            <div className="discount-preview">
              <span>desconto / ajuste aplicado</span>
              <strong>
                {money(Math.max(0, selectedCardBill - (Number(launchAmount.replace(",", ".")) || 0)))}
              </strong>
            </div>
            <button className="primary-button full" type="submit">
              <Check size={17} /> confirmar pagamento da fatura
            </button>
          </form>
        </ModalShell>
      )}

      {modal === "anticipate" && (
        <ModalShell title="Antecipar parcelas" eyebrow="financiamento Santander" onClose={() => setModal(null)}>
          <div className="anticipate-card">
            <div className="anticipate-icon">
              <ArrowUpRight size={22} />
            </div>
            <div>
              <strong>Reduza os juros do contrato</strong>
              <span>Ao antecipar, você deixa de pagar os juros remuneratórios das parcelas escolhidas.</span>
            </div>
          </div>
          <label className="range-label">
            Quantas parcelas? <strong>{anticipationQty}</strong>
            <input
              type="range"
              min="1"
              max={Math.max(1, finance?.term - (finance?.paidCount ?? 0))}
              value={anticipationQty}
              onChange={(event) => setAnticipationQty(Number(event.target.value))}
            />
          </label>
          <div className="anticipate-summary">
            <div>
              <span>valor base</span>
              <strong>{money((finance?.installment ?? 0) * anticipationQty)}</strong>
            </div>
            <div>
              <span>estimativa de desconto</span>
              <strong className="green-text">
                - {money((finance?.installment ?? 0) * anticipationQty * 0.08)}
              </strong>
            </div>
            <div className="total-line">
              <span>total estimado</span>
              <strong>{money((finance?.installment ?? 0) * anticipationQty * 0.92)}</strong>
            </div>
          </div>
          <button className="primary-button full" onClick={confirmAnticipation}>
            <Check size={17} /> confirmar antecipação
          </button>
        </ModalShell>
      )}

      {modal === "backup" && (
        <ModalShell title="Dados e privacidade" eyebrow="100% offline" onClose={() => setModal(null)}>
          <div className="backup-intro">
            <div className="backup-icon">
              <ShieldCheck size={22} />
            </div>
            <div>
              <strong>Seu controle, só seu</strong>
              <span>
                As informações ficam no armazenamento deste dispositivo. Faça backups periódicos para não perder nada.
              </span>
            </div>
          </div>
          <div className="backup-actions">
            <button className="backup-action" onClick={exportBackup}>
              <span>
                <Download size={18} />
              </span>
              <div>
                <strong>Fazer backup</strong>
                <small>Baixar arquivo JSON</small>
              </div>
              <ChevronRight size={17} />
            </button>
            <button className="backup-action" onClick={() => importInput.current?.click()}>
              <span>
                <Upload size={18} />
              </span>
              <div>
                <strong>Restaurar backup</strong>
                <small>Usar um arquivo salvo</small>
              </div>
              <ChevronRight size={17} />
            </button>
            <input ref={importInput} type="file" accept="application/json,.json" hidden onChange={importBackup} />
            <button className="backup-action danger" onClick={resetData}>
              <span>
                <RotateCcw size={18} />
              </span>
              <div>
                <strong>Restaurar demonstração</strong>
                <small>Voltar aos dados do contrato</small>
              </div>
              <ChevronRight size={17} />
            </button>
          </div>
        </ModalShell>
      )}

      {toast && (
        <div className="toast">
          <Check size={16} /> {toast}
        </div>
      )}
    </div>
  );
}