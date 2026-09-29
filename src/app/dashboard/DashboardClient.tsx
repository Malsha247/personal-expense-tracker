
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Trash2,
  Pencil,
  LogOut,
  LayoutDashboard,
  Tags,
  ArrowLeftRight,
  RefreshCw,
} from "lucide-react";

// ================= TYPES =================

type TransactionType = "INCOME" | "EXPENSE";

type Category = {
  id: string;
  name: string;
  type: TransactionType;
};

type Transaction = {
  id: string;
  title: string;
  amount: string;
  type: TransactionType;
  categoryId: string;
  category: {
    name: string;
  };
  date: string;
  note: string | null;
};

type TransactionForm = {
  id: string;
  title: string;
  amount: string;
  type: TransactionType;
  categoryId: string;
  date: string;
  note: string;
};

type Props = {
  userName: string;
  userEmail: string;
};

type DashboardData = {
  categories?: Category[];
  transactions?: Transaction[];
  errors: string[];
};

// ================= HELPERS =================

function getToday() {
  const date = new Date();

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function createInitialForm(): TransactionForm {
  return {
    id: "",
    title: "",
    amount: "",
    type: "EXPENSE",
    categoryId: "",
    date: getToday(),
    note: "",
  };
}

function money(amount: number) {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong";
}

// ================= API HELPER =================

async function apiRequest(
  url: string,
  options?: RequestInit
): Promise<unknown> {
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
  });

  const contentType =
    response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error(
      `API error: ${response.status} ${response.statusText} (${url})`
    );
  }

  const text = await response.text();

  if (!text.trim()) {
    throw new Error(
      `Empty API response: ${response.status} (${url})`
    );
  }

  const data: unknown = JSON.parse(text);

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;

    if (
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof data.error === "string"
    ) {
      message = data.error;
    }

    throw new Error(message);
  }

  return data;
}

async function loadDashboardData(): Promise<DashboardData> {
  const [categoriesResult, transactionsResult] =
    await Promise.allSettled([
      apiRequest("/api/categories"),
      apiRequest("/api/transactions"),
    ]);

  const result: DashboardData = {
    errors: [],
  };

  // Categories load independently
  if (categoriesResult.status === "fulfilled") {
    const data = categoriesResult.value;

    if (Array.isArray(data)) {
      result.categories = data as Category[];
    } else {
      result.errors.push(
        "Categories API returned invalid data."
      );
    }
  } else {
    result.errors.push(
      `Categories: ${errorMessage(categoriesResult.reason)}`
    );
  }

  // Transactions load independently
  if (transactionsResult.status === "fulfilled") {
    const data = transactionsResult.value;

    if (Array.isArray(data)) {
      result.transactions = data as Transaction[];
    } else {
      result.errors.push(
        "Transactions API returned invalid data."
      );
    }
  } else {
    result.errors.push(
      `Transactions: ${errorMessage(transactionsResult.reason)}`
    );
  }

  return result;
}

// ================= CSS CLASSES =================

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

const buttonClass =
  "rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50";

// ================= MAIN COMPONENT =================

export default function DashboardClient({
  userName,
  userEmail,
}: Props) {

  // Data
  const [categories, setCategories] =
    useState<Category[]>([]);

  const [transactions, setTransactions] =
    useState<Transaction[]>([]);

  // Data availability
  const [categoriesLoaded, setCategoriesLoaded] =
    useState(false);

  const [transactionsLoaded, setTransactionsLoaded] =
    useState(false);

  // Forms
  const [form, setForm] =
    useState<TransactionForm>(createInitialForm);

  const [categoryName, setCategoryName] =
    useState("");

  const [categoryType, setCategoryType] =
    useState<TransactionType>("EXPENSE");

  // UI states
  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  // ================= LOAD DATA =================

  const refreshData = useCallback(async () => {
    const result = await loadDashboardData();

    if (result.categories !== undefined) {
      setCategories(result.categories);
      setCategoriesLoaded(true);
    }

    if (result.transactions !== undefined) {
      setTransactions(result.transactions);
      setTransactionsLoaded(true);
    }

    setError(result.errors.join(" | "));

    setLoading(false);
  }, []);

  // Initial fetch
  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        const result = await loadDashboardData();

        if (cancelled) return;

        if (result.categories !== undefined) {
          setCategories(result.categories);
          setCategoriesLoaded(true);
        }

        if (result.transactions !== undefined) {
          setTransactions(result.transactions);
          setTransactionsLoaded(true);
        }

        setError(result.errors.join(" | "));

      } catch (err) {
        if (!cancelled) {
          setError(errorMessage(err));
        }

      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, []);

  // ================= CALCULATIONS =================

  const totalIncome = useMemo(() => {
    return transactions
      .filter((t) => t.type === "INCOME")
      .reduce(
        (sum, t) => sum + Number(t.amount),
        0
      );
  }, [transactions]);

  const totalExpenses = useMemo(() => {
    return transactions
      .filter((t) => t.type === "EXPENSE")
      .reduce(
        (sum, t) => sum + Number(t.amount),
        0
      );
  }, [transactions]);

  const totalBalance =
    totalIncome - totalExpenses;

  // Category filtering
  const incomeCategories = categories.filter(
    (c) => c.type === "INCOME"
  );

  const expenseCategories = categories.filter(
    (c) => c.type === "EXPENSE"
  );

  const availableCategories = categories.filter(
    (c) => c.type === form.type
  );

  // ================= DEFAULT CATEGORIES =================

  async function addDefaultCategories() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const data = await apiRequest(
        "/api/categories/defaults",
        {
          method: "POST",
        }
      );

      let created = 0;

      if (
        typeof data === "object" &&
        data !== null &&
        "created" in data &&
        typeof data.created === "number"
      ) {
        created = data.created;
      }

      await refreshData();

      setMessage(
        created > 0
          ? `${created} default categories added successfully!`
          : "Default categories already exist."
      );

    } catch (err) {
      setError(errorMessage(err));

    } finally {
      setSaving(false);
    }
  }

  // ================= CUSTOM CATEGORY =================

  async function saveCategory(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await apiRequest("/api/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: categoryName,
          type: categoryType,
        }),
      });

      setCategoryName("");

      await refreshData();

      setMessage(
        "Category created successfully!"
      );

    } catch (err) {
      setError(errorMessage(err));

    } finally {
      setSaving(false);
    }
  }

  // ================= SAVE TRANSACTION =================

  async function saveTransaction(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const isEditing = Boolean(form.id);

      await apiRequest("/api/transactions", {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      setForm(createInitialForm());

      await refreshData();

      setMessage(
        isEditing
          ? "Transaction updated successfully!"
          : "Transaction added successfully!"
      );

    } catch (err) {
      setError(errorMessage(err));

    } finally {
      setSaving(false);
    }
  }

  // ================= EDIT TRANSACTION =================

  function editTransaction(transaction: Transaction) {
    setForm({
      id: transaction.id,
      title: transaction.title,
      amount: transaction.amount,
      type: transaction.type,
      categoryId: transaction.categoryId,
      date: transaction.date.slice(0, 10),
      note: transaction.note || "",
    });

    document
      .getElementById("transaction-form")
      ?.scrollIntoView({
        behavior: "smooth",
      });
  }

  // ================= DELETE TRANSACTION =================

  async function deleteTransaction(id: string) {
    if (
      !window.confirm(
        "Are you sure you want to delete this transaction?"
      )
    ) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await apiRequest("/api/transactions", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      await refreshData();

      setMessage(
        "Transaction deleted successfully!"
      );

    } catch (err) {
      setError(errorMessage(err));

    } finally {
      setSaving(false);
    }
  }

  // ================= LOGOUT =================

  async function logout() {
    try {
      await apiRequest("/api/auth/logout", {
        method: "POST",
      });

      window.location.replace("/login");

    } catch (err) {
      setError(errorMessage(err));
    }
  }

  // ================= UI =================

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 lg:flex">

      {/* SIDEBAR */}

      <aside className="bg-slate-950 p-6 text-white lg:min-h-screen lg:w-64 lg:shrink-0">

        <h1 className="mb-9 text-2xl font-bold">
          Expense
          <span className="text-emerald-400">
            Tracker
          </span>
        </h1>

        <nav className="flex flex-wrap gap-2 lg:flex-col">

          <a
            href="#dashboard"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-300 hover:bg-slate-800"
          >
            <LayoutDashboard size={19} />
            Dashboard
          </a>

          <a
            href="#categories"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-300 hover:bg-slate-800"
          >
            <Tags size={19} />
            Categories
          </a>

          <a
            href="#transaction-form"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-300 hover:bg-slate-800"
          >
            <Plus size={19} />
            Add Transaction
          </a>

          <a
            href="#transactions"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-300 hover:bg-slate-800"
          >
            <ArrowLeftRight size={19} />
            Transactions
          </a>

          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-300 hover:bg-slate-800"
          >
            <LogOut size={19} />
            Logout
          </button>

        </nav>
      </aside>

      {/* MAIN CONTENT */}

      <main
        id="dashboard"
        className="min-w-0 flex-1 p-5 md:p-8"
      >

        {/* HEADER */}

        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">

          <div>
            <h2 className="text-3xl font-bold">
              Financial Dashboard
            </h2>

            <p className="mt-2 text-slate-500">
              Welcome back, {userName}
            </p>

            <p className="text-sm text-slate-400">
              {userEmail}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">

            <button
              type="button"
              onClick={() => void refreshData()}
              className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm hover:bg-slate-50"
            >
              <RefreshCw size={17} />
              Refresh
            </button>

            <a
              href="#transaction-form"
              className={buttonClass}
            >
              + Add Transaction
            </a>

          </div>
        </header>

        {/* ERROR MESSAGE */}

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600"
          >
            {error}
          </div>
        )}

        {/* SUCCESS MESSAGE */}

        {message && (
          <div
            role="status"
            className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
          >
            {message}
          </div>
        )}

        {/* SUMMARY CARDS */}

        <div className="grid gap-5 md:grid-cols-3">

          <SummaryCard
            title="Total Balance"
            value={
              transactionsLoaded
                ? money(totalBalance)
                : "Unavailable"
            }
            icon={<Wallet />}
            color="bg-emerald-100 text-emerald-600"
          />

          <SummaryCard
            title="Total Income"
            value={
              transactionsLoaded
                ? money(totalIncome)
                : "Unavailable"
            }
            icon={<ArrowUpRight />}
            color="bg-blue-100 text-blue-600"
          />

          <SummaryCard
            title="Total Expenses"
            value={
              transactionsLoaded
                ? money(totalExpenses)
                : "Unavailable"
            }
            icon={<ArrowDownRight />}
            color="bg-rose-100 text-rose-600"
          />

        </div>

        {/* LOADING */}

        {loading && (
          <p className="mt-6 text-sm text-slate-500">
            Loading dashboard data...
          </p>
        )}

        {/* CATEGORIES SECTION */}

        <section
          id="categories"
          className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >

          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">

            <div>
              <h3 className="text-xl font-semibold">
                Manage Categories
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Manage income and expense categories.
              </p>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={addDefaultCategories}
              className={buttonClass}
            >
              {saving
                ? "Please wait..."
                : "Add Default Categories"}
            </button>

          </div>

          {/* CREATE CATEGORY FORM */}

          <form
            onSubmit={saveCategory}
            className="grid gap-4 md:grid-cols-3"
          >

            <input
              required
              minLength={2}
              maxLength={50}
              className={inputClass}
              placeholder="Category name (e.g. Food)"
              value={categoryName}
              onChange={(event) =>
                setCategoryName(event.target.value)
              }
            />

            <select
              className={inputClass}
              value={categoryType}
              onChange={(event) =>
                setCategoryType(
                  event.target.value as TransactionType
                )
              }
            >
              <option value="EXPENSE">
                Expense
              </option>

              <option value="INCOME">
                Income
              </option>
            </select>

            <button
              type="submit"
              disabled={saving}
              className={buttonClass}
            >
              Create Category
            </button>

          </form>

          {/* CATEGORY LISTS */}

          <div className="mt-8 grid gap-6 md:grid-cols-2">

            {/* INCOME CATEGORIES */}

            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-5">

              <h4 className="mb-4 font-semibold text-emerald-800">
                Income Categories ({incomeCategories.length})
              </h4>

              <div className="flex flex-wrap gap-2">

                {incomeCategories.map((category) => (
                  <span
                    key={category.id}
                    className="rounded-full border border-emerald-200 bg-white px-3 py-2 text-sm text-emerald-700"
                  >
                    {category.name}
                  </span>
                ))}

                {incomeCategories.length === 0 && (
                  <p className="text-sm text-slate-500">
                    {categoriesLoaded
                      ? "No income categories yet."
                      : "Categories not loaded."}
                  </p>
                )}

              </div>
            </div>

            {/* EXPENSE CATEGORIES */}

            <div className="rounded-xl border border-rose-100 bg-rose-50 p-5">

              <h4 className="mb-4 font-semibold text-rose-800">
                Expense Categories ({expenseCategories.length})
              </h4>

              <div className="flex flex-wrap gap-2">

                {expenseCategories.map((category) => (
                  <span
                    key={category.id}
                    className="rounded-full border border-rose-200 bg-white px-3 py-2 text-sm text-rose-700"
                  >
                    {category.name}
                  </span>
                ))}

                {expenseCategories.length === 0 && (
                  <p className="text-sm text-slate-500">
                    {categoriesLoaded
                      ? "No expense categories yet."
                      : "Categories not loaded."}
                  </p>
                )}

              </div>
            </div>

          </div>
        </section>

        {/* TRANSACTION FORM */}

        <section
          id="transaction-form"
          className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >

          <h3 className="mb-6 text-xl font-semibold">
            {form.id
              ? "Edit Transaction"
              : "Add New Transaction"}
          </h3>

          <form
            onSubmit={saveTransaction}
            className="grid gap-4 md:grid-cols-2"
          >

            {/* TITLE */}

            <div>
              <label
                htmlFor="transaction-title"
                className="mb-2 block text-sm font-medium"
              >
                Title
              </label>

              <input
                id="transaction-title"
                required
                minLength={2}
                maxLength={100}
                className={inputClass}
                placeholder="e.g. Grocery Shopping"
                value={form.title}
                onChange={(event) =>
                  setForm({
                    ...form,
                    title: event.target.value,
                  })
                }
              />
            </div>

            {/* AMOUNT */}

            <div>
              <label
                htmlFor="transaction-amount"
                className="mb-2 block text-sm font-medium"
              >
                Amount (LKR)
              </label>

              <input
                id="transaction-amount"
                required
                type="number"
                min="0.01"
                max="9999999999.99"
                step="0.01"
                className={inputClass}
                value={form.amount}
                onChange={(event) =>
                  setForm({
                    ...form,
                    amount: event.target.value,
                  })
                }
              />
            </div>

            {/* TYPE */}

            <div>
              <label
                htmlFor="transaction-type"
                className="mb-2 block text-sm font-medium"
              >
                Transaction Type
              </label>

              <select
                id="transaction-type"
                className={inputClass}
                value={form.type}
                onChange={(event) =>
                  setForm({
                    ...form,
                    type: event.target.value as TransactionType,
                    categoryId: "",
                  })
                }
              >
                <option value="EXPENSE">
                  Expense
                </option>

                <option value="INCOME">
                  Income
                </option>
              </select>
            </div>

            {/* CATEGORY */}

            <div>
              <label
                htmlFor="transaction-category"
                className="mb-2 block text-sm font-medium"
              >
                Category
              </label>

              <select
                id="transaction-category"
                required
                className={inputClass}
                value={form.categoryId}
                onChange={(event) =>
                  setForm({
                    ...form,
                    categoryId: event.target.value,
                  })
                }
              >

                <option value="">
                  Select Category
                </option>

                {availableCategories.map((category) => (
                  <option
                    key={category.id}
                    value={category.id}
                  >
                    {category.name}
                  </option>
                ))}

              </select>

              {availableCategories.length === 0 && (
                <p className="mt-2 text-xs text-amber-600">
                  Create a category first.
                </p>
              )}
            </div>

            {/* DATE */}

            <div>
              <label
                htmlFor="transaction-date"
                className="mb-2 block text-sm font-medium"
              >
                Date
              </label>

              <input
                id="transaction-date"
                required
                type="date"
                className={inputClass}
                value={form.date}
                onChange={(event) =>
                  setForm({
                    ...form,
                    date: event.target.value,
                  })
                }
              />
            </div>

            {/* NOTE */}

            <div>
              <label
                htmlFor="transaction-note"
                className="mb-2 block text-sm font-medium"
              >
                Note
              </label>

              <input
                id="transaction-note"
                maxLength={500}
                className={inputClass}
                placeholder="Optional note"
                value={form.note}
                onChange={(event) =>
                  setForm({
                    ...form,
                    note: event.target.value,
                  })
                }
              />
            </div>

            {/* BUTTONS */}

            <div className="flex flex-wrap gap-3 md:col-span-2">

              <button
                type="submit"
                disabled={
                  saving ||
                  !categoriesLoaded ||
                  availableCategories.length === 0
                }
                className={buttonClass}
              >
                {saving
                  ? "Saving..."
                  : form.id
                    ? "Update Transaction"
                    : "Save Transaction"}
              </button>

              {form.id && (
                <button
                  type="button"
                  onClick={() =>
                    setForm(createInitialForm())
                  }
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm"
                >
                  Cancel Edit
                </button>
              )}

            </div>

          </form>
        </section>

        {/* TRANSACTIONS TABLE */}

        <section
          id="transactions"
          className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >

          <div className="mb-5 flex items-center justify-between">

            <h3 className="text-xl font-semibold">
              Recent Transactions
            </h3>

            <span className="text-sm text-slate-500">
              {transactionsLoaded
                ? `${transactions.length} records`
                : "Unavailable"}
            </span>

          </div>

          <div className="overflow-x-auto">

            <table className="w-full text-left text-sm">

              <thead className="border-b bg-slate-50 text-slate-500">

                <tr>
                  <th className="p-4">Title</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Actions</th>
                </tr>

              </thead>

              <tbody>

                {transactions.map((transaction) => (

                  <tr
                    key={transaction.id}
                    className="border-b border-slate-100"
                  >

                    <td className="p-4 font-medium">
                      {transaction.title}
                    </td>

                    <td className="p-4">
                      {transaction.category.name}
                    </td>

                    <td className="p-4">
                      {transaction.date.slice(0, 10)}
                    </td>

                    <td className="p-4">

                      <span
                        className={`rounded-full px-3 py-1 text-xs ${
                          transaction.type === "INCOME"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {transaction.type}
                      </span>

                    </td>

                    <td
                      className={`p-4 font-semibold ${
                        transaction.type === "INCOME"
                          ? "text-emerald-600"
                          : "text-rose-600"
                      }`}
                    >

                      {transaction.type === "INCOME"
                        ? "+"
                        : "-"}

                      {money(Number(transaction.amount))}

                    </td>

                    <td className="p-4">

                      <div className="flex gap-3">

                        <button
                          type="button"
                          disabled={saving}
                          aria-label={`Edit ${transaction.title}`}
                          onClick={() =>
                            editTransaction(transaction)
                          }
                          className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                        >
                          <Pencil size={18} />
                        </button>

                        <button
                          type="button"
                          disabled={saving}
                          aria-label={`Delete ${transaction.title}`}
                          onClick={() =>
                            deleteTransaction(transaction.id)
                          }
                          className="text-rose-600 hover:text-rose-800 disabled:opacity-50"
                        >
                          <Trash2 size={18} />
                        </button>

                      </div>

                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

            {transactionsLoaded &&
              transactions.length === 0 && (
                <p className="py-10 text-center text-slate-400">
                  No transactions yet.
                </p>
              )}

            {!transactionsLoaded && (
              <p className="py-10 text-center text-amber-600">
                Transactions API is unavailable.
                Check the server terminal.
              </p>
            )}

          </div>
        </section>

      </main>
    </div>
  );
}

// ================= SUMMARY CARD =================

function SummaryCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

      <div className="mb-5 flex items-center justify-between">

        <p className="text-sm font-medium text-slate-500">
          {title}
        </p>

        <div className={`rounded-xl p-3 ${color}`}>
          {icon}
        </div>

      </div>

      <h3 className="break-words text-2xl font-bold">
        {value}
      </h3>

    </div>
  );
}
