
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

type Props = {
  userName: string;
  userEmail: string;
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

// ================= HELPERS =================

function getToday() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

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

const money = (amount: number) =>
  new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

// ================= API HELPER =================

async function fetchDashboardData() {
  const [transactionsResponse, categoriesResponse] =
    await Promise.all([
      fetch("/api/transactions", {
        cache: "no-store",
      }),

      fetch("/api/categories", {
        cache: "no-store",
      }),
    ]);

  if (
    !transactionsResponse.ok ||
    !categoriesResponse.ok
  ) {
    throw new Error("Failed to load financial data");
  }

  const transactionsData: Transaction[] =
    await transactionsResponse.json();

  const categoriesData: Category[] =
    await categoriesResponse.json();

  return {
    transactionsData,
    categoriesData,
  };
}

async function apiRequest(
  url: string,
  method: string,
  body?: unknown
) {
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    ...(body !== undefined
      ? { body: JSON.stringify(body) }
      : {}),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || "Something went wrong"
    );
  }

  return data;
}

// ================= MAIN COMPONENT =================

export default function DashboardClient({
  userName,
  userEmail,
}: Props) {

  // Data
  const [transactions, setTransactions] =
    useState<Transaction[]>([]);

  const [categories, setCategories] =
    useState<Category[]>([]);

  // Forms
  const [form, setForm] =
    useState<TransactionForm>(createInitialForm);

  const [categoryName, setCategoryName] =
    useState("");

  const [categoryType, setCategoryType] =
    useState<TransactionType>("EXPENSE");

  // UI State
  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  // ================= LOAD DATA =================

  // Used after create, edit and delete operations
  const loadData = useCallback(async () => {
    try {
      const {
        transactionsData,
        categoriesData,
      } = await fetchDashboardData();

      setTransactions(transactionsData);
      setCategories(categoriesData);
      setError("");

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load dashboard data"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial data loading
  // State updates happen after asynchronous fetch.
  useEffect(() => {
    let cancelled = false;

    async function fetchInitialData() {
      try {
        const {
          transactionsData,
          categoriesData,
        } = await fetchDashboardData();

        if (cancelled) return;

        setTransactions(transactionsData);
        setCategories(categoriesData);
        setError("");

      } catch (err) {
        if (cancelled) return;

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load dashboard data"
        );

      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchInitialData();

    return () => {
      cancelled = true;
    };
  }, []);

  // ================= FINANCIAL CALCULATIONS =================

  const totalIncome = useMemo(() => {
    return transactions
      .filter((transaction) =>
        transaction.type === "INCOME"
      )
      .reduce(
        (total, transaction) =>
          total + Number(transaction.amount),
        0
      );
  }, [transactions]);

  const totalExpenses = useMemo(() => {
    return transactions
      .filter((transaction) =>
        transaction.type === "EXPENSE"
      )
      .reduce(
        (total, transaction) =>
          total + Number(transaction.amount),
        0
      );
  }, [transactions]);

  const balance = totalIncome - totalExpenses;

  const availableCategories = categories.filter(
    (category) =>
      category.type === form.type
  );

  // ================= SAVE CATEGORY =================

  async function saveCategory(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await apiRequest(
        "/api/categories",
        "POST",
        {
          name: categoryName,
          type: categoryType,
        }
      );

      setCategoryName("");

      setMessage(
        "Category created successfully"
      );

      await loadData();

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create category"
      );

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
      const editing = Boolean(form.id);

      await apiRequest(
        "/api/transactions",
        editing ? "PATCH" : "POST",
        form
      );

      setForm(createInitialForm());

      setMessage(
        editing
          ? "Transaction updated successfully"
          : "Transaction added successfully"
      );

      await loadData();

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save transaction"
      );

    } finally {
      setSaving(false);
    }
  }

  // ================= EDIT TRANSACTION =================

  function editTransaction(
    transaction: Transaction
  ) {
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

  async function deleteTransaction(
    id: string
  ) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this transaction?"
    );

    if (!confirmed) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await apiRequest(
        "/api/transactions",
        "DELETE",
        { id }
      );

      setMessage(
        "Transaction deleted successfully"
      );

      await loadData();

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete transaction"
      );

    } finally {
      setSaving(false);
    }
  }

  // ================= LOGOUT =================

  async function logout() {
    try {
      await apiRequest(
        "/api/auth/logout",
        "POST"
      );

      window.location.replace("/login");

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Logout failed"
      );
    }
  }

  // ================= STYLES =================

  const inputClass =
    "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

  const buttonClass =
    "rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50";

  // ================= UI =================

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 lg:flex">

      {/* SIDEBAR */}

      <aside className="bg-slate-950 p-6 text-white lg:min-h-screen lg:w-64 lg:shrink-0">

        <h1 className="mb-10 text-2xl font-bold">
          Expense
          <span className="text-emerald-400">
            Tracker
          </span>
        </h1>

        <nav className="space-y-3">

          <a
            href="#dashboard"
            className="flex items-center gap-3 rounded-xl bg-emerald-600 px-4 py-3"
          >
            <LayoutDashboard size={20} />
            Dashboard
          </a>

          <a
            href="#categories"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-300 hover:bg-slate-800"
          >
            <Tags size={20} />
            Categories
          </a>

          <a
            href="#transaction-form"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-300 hover:bg-slate-800"
          >
            <Plus size={20} />
            Add Transaction
          </a>

          <a
            href="#transactions"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-300 hover:bg-slate-800"
          >
            <ArrowLeftRight size={20} />
            Transactions
          </a>

          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-slate-300 hover:bg-slate-800"
          >
            <LogOut size={20} />
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

          <a
            href="#transaction-form"
            className={buttonClass}
          >
            + Add Transaction
          </a>

        </header>

        {/* ALERTS */}

        {error && (
          <p
            role="alert"
            className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-600"
          >
            {error}
          </p>
        )}

        {message && (
          <p
            role="status"
            className="mb-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700"
          >
            {message}
          </p>
        )}

        {loading ? (
          <div className="rounded-2xl bg-white p-8 text-center text-slate-500">
            Loading financial data...
          </div>
        ) : (
          <>

            {/* SUMMARY CARDS */}

            <div className="grid gap-5 md:grid-cols-3">

              <SummaryCard
                title="Total Balance"
                value={money(balance)}
                icon={<Wallet size={24} />}
                color="bg-emerald-100 text-emerald-600"
              />

              <SummaryCard
                title="Total Income"
                value={money(totalIncome)}
                icon={<ArrowUpRight size={24} />}
                color="bg-blue-100 text-blue-600"
              />

              <SummaryCard
                title="Total Expenses"
                value={money(totalExpenses)}
                icon={<ArrowDownRight size={24} />}
                color="bg-rose-100 text-rose-600"
              />

            </div>

            {/* CATEGORY MANAGEMENT */}

            <section
              id="categories"
              className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >

              <h3 className="mb-5 text-xl font-semibold">
                Manage Categories
              </h3>

              <form
                onSubmit={saveCategory}
                className="grid gap-4 md:grid-cols-3"
              >

                <input
                  required
                  minLength={2}
                  maxLength={50}
                  className={inputClass}
                  placeholder="e.g. Food"
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
                  Add Category
                </button>

              </form>

              {/* CATEGORY LIST */}

              <div className="mt-5 flex flex-wrap gap-2">

                {categories.map((category) => (
                  <span
                    key={category.id}
                    className="rounded-full bg-slate-100 px-4 py-2 text-sm"
                  >
                    {category.name} – {category.type}
                  </span>
                ))}

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
                      Please create a category first.
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

                {/* ACTION BUTTONS */}

                <div className="flex flex-wrap gap-3 md:col-span-2">

                  <button
                    type="submit"
                    disabled={saving}
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
                      className="rounded-xl border border-slate-300 px-5 py-3 text-sm hover:bg-slate-50"
                    >
                      Cancel Edit
                    </button>
                  )}

                </div>

              </form>

            </section>

            {/* TRANSACTION TABLE */}

            <section
              id="transactions"
              className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >

              <div className="mb-5 flex items-center justify-between">

                <h3 className="text-xl font-semibold">
                  Recent Transactions
                </h3>

                <span className="text-sm text-slate-500">
                  {transactions.length} records
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
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
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

                {transactions.length === 0 && (
                  <p className="py-10 text-center text-slate-400">
                    No transactions yet. Add your first transaction!
                  </p>
                )}

              </div>

            </section>

          </>
        )}

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