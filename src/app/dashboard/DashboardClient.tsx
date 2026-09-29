
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Wallet, ArrowUpRight, ArrowDownRight,
  Plus, Pencil, Trash2, LogOut, Tags,
  LayoutDashboard, ArrowLeftRight,
} from "lucide-react";

type Type = "INCOME" | "EXPENSE";

type Category = {
  id: string;
  name: string;
  type: Type;
};

type Transaction = {
  id: string;
  title: string;
  amount: string;
  type: Type;
  categoryId: string;
  category: { name: string };
  date: string;
  note: string | null;
};

type FormData = {
  id: string;
  title: string;
  amount: string;
  type: Type;
  categoryId: string;
  date: string;
  note: string;
};

type Props = {
  userName: string;
  userEmail: string;
};

function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function emptyForm(): FormData {
  return {
    id: "",
    title: "",
    amount: "",
    type: "EXPENSE",
    categoryId: "",
    date: today(),
    note: "",
  };
}

function money(amount: number) {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
  }).format(amount);
}

async function request(
  url: string,
  options?: RequestInit
) {
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

async function getDashboardData(): Promise<{
  categories: Category[];
  transactions: Transaction[];
}> {
  const [categories, transactions] = await Promise.all([
    request("/api/categories"),
    request("/api/transactions"),
  ]);

  return { categories, transactions };
}

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

const buttonClass =
  "rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50";

export default function DashboardClient({
  userName,
  userEmail,
}: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [form, setForm] = useState<FormData>(emptyForm);
  const [categoryName, setCategoryName] = useState("");
  const [categoryType, setCategoryType] = useState<Type>("EXPENSE");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Reload data after create/update/delete
  const loadData = useCallback(async () => {
    const data = await getDashboardData();
    setCategories(data.categories);
    setTransactions(data.transactions);
  }, []);

  // Initial fetch - avoids synchronous setState in effect
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const data = await getDashboardData();

        if (!cancelled) {
          setCategories(data.categories);
          setTransactions(data.transactions);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Loading failed"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void init();

    return () => {
      cancelled = true;
    };
  }, []);

  const income = useMemo(
    () => transactions
      .filter(t => t.type === "INCOME")
      .reduce((sum, t) => sum + Number(t.amount), 0),
    [transactions]
  );

  const expenses = useMemo(
    () => transactions
      .filter(t => t.type === "EXPENSE")
      .reduce((sum, t) => sum + Number(t.amount), 0),
    [transactions]
  );

  const balance = income - expenses;

  const incomeCategories = categories.filter(
    c => c.type === "INCOME"
  );

  const expenseCategories = categories.filter(
    c => c.type === "EXPENSE"
  );

  const availableCategories = categories.filter(
    c => c.type === form.type
  );

  // Add default categories
  async function addDefaults() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const data = await request("/api/categories/defaults", {
        method: "POST",
      });

      await loadData();

      setMessage(
        `${data.created} default categories added successfully`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to add categories"
      );
    } finally {
      setSaving(false);
    }
  }

  // Add custom category
  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      await request("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: categoryName,
          type: categoryType,
        }),
      });

      await loadData();

      setCategoryName("");
      setMessage("Category created successfully");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Category creation failed"
      );
    } finally {
      setSaving(false);
    }
  }

  // Save or update transaction
  async function saveTransaction(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const editing = Boolean(form.id);

      await request("/api/transactions", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      await loadData();
      setForm(emptyForm());

      setMessage(
        editing ? "Transaction updated" : "Transaction added"
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Transaction failed"
      );
    } finally {
      setSaving(false);
    }
  }

  function editTransaction(t: Transaction) {
    setForm({
      id: t.id,
      title: t.title,
      amount: t.amount,
      type: t.type,
      categoryId: t.categoryId,
      date: t.date.slice(0, 10),
      note: t.note || "",
    });

    document.getElementById("transaction-form")
      ?.scrollIntoView({ behavior: "smooth" });
  }

  async function deleteTransaction(id: string) {
    if (!window.confirm("Delete this transaction?")) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await request("/api/transactions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      await loadData();
      setMessage("Transaction deleted successfully");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Delete failed"
      );
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    try {
      await request("/api/auth/logout", {
        method: "POST",
      });

      window.location.replace("/login");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Logout failed"
      );
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 lg:flex">

      {/* SIDEBAR */}
      <aside className="bg-slate-950 p-6 text-white lg:min-h-screen lg:w-64 lg:shrink-0">
        <h1 className="mb-9 text-2xl font-bold">
          Expense<span className="text-emerald-400">Tracker</span>
        </h1>

        <nav className="flex flex-wrap gap-2 lg:flex-col">
          {[
            { label: "Dashboard", href: "#dashboard", icon: LayoutDashboard },
            { label: "Categories", href: "#categories", icon: Tags },
            { label: "Add Transaction", href: "#transaction-form", icon: Plus },
            { label: "Transactions", href: "#transactions", icon: ArrowLeftRight },
          ].map(item => {
            const Icon = item.icon;

            return (
              <a
                key={item.label}
                href={item.href}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                <Icon size={19} />
                {item.label}
              </a>
            );
          })}

          <button
            onClick={logout}
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-300 hover:bg-slate-800"
          >
            <LogOut size={19} />
            Logout
          </button>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main id="dashboard" className="min-w-0 flex-1 p-5 md:p-8">

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

          <a href="#transaction-form" className={buttonClass}>
            + Add Transaction
          </a>
        </header>

        {error && (
          <div role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {message && (
          <div role="status" className="mb-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">
            {message}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl bg-white p-8">
            Loading dashboard...
          </div>
        ) : (
          <>

            {/* SUMMARY CARDS */}
            <div className="grid gap-5 md:grid-cols-3">
              <SummaryCard
                title="Total Balance"
                value={money(balance)}
                icon={<Wallet />}
                color="bg-emerald-100 text-emerald-600"
              />

              <SummaryCard
                title="Total Income"
                value={money(income)}
                icon={<ArrowUpRight />}
                color="bg-blue-100 text-blue-600"
              />

              <SummaryCard
                title="Total Expenses"
                value={money(expenses)}
                icon={<ArrowDownRight />}
                color="bg-rose-100 text-rose-600"
              />
            </div>

            {/* CATEGORIES */}
            <section
              id="categories"
              className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold">
                    Manage Categories
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Add default or custom financial categories.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addDefaults}
                  disabled={saving}
                  className={buttonClass}
                >
                  {saving ? "Please wait..." : "Add Default Categories"}
                </button>
              </div>

              <form
                onSubmit={addCategory}
                className="grid gap-4 md:grid-cols-3"
              >
                <input
                  required
                  minLength={2}
                  maxLength={50}
                  className={inputClass}
                  placeholder="Category name"
                  value={categoryName}
                  onChange={e => setCategoryName(e.target.value)}
                />

                <select
                  className={inputClass}
                  value={categoryType}
                  onChange={e => setCategoryType(e.target.value as Type)}
                >
                  <option value="EXPENSE">Expense</option>
                  <option value="INCOME">Income</option>
                </select>

                <button
                  type="submit"
                  disabled={saving}
                  className={buttonClass}
                >
                  Create Category
                </button>
              </form>

              <div className="mt-8 grid gap-6 md:grid-cols-2">

                {/* Income Categories */}
                <div className="rounded-xl bg-emerald-50 p-5">
                  <h4 className="mb-4 font-semibold text-emerald-800">
                    Income Categories ({incomeCategories.length})
                  </h4>

                  <div className="flex flex-wrap gap-2">
                    {incomeCategories.map(c => (
                      <span
                        key={c.id}
                        className="rounded-full border border-emerald-200 bg-white px-3 py-2 text-sm text-emerald-700"
                      >
                        {c.name}
                      </span>
                    ))}

                    {incomeCategories.length === 0 && (
                      <p className="text-sm text-slate-500">
                        No income categories yet.
                      </p>
                    )}
                  </div>
                </div>

                {/* Expense Categories */}
                <div className="rounded-xl bg-rose-50 p-5">
                  <h4 className="mb-4 font-semibold text-rose-800">
                    Expense Categories ({expenseCategories.length})
                  </h4>

                  <div className="flex flex-wrap gap-2">
                    {expenseCategories.map(c => (
                      <span
                        key={c.id}
                        className="rounded-full border border-rose-200 bg-white px-3 py-2 text-sm text-rose-700"
                      >
                        {c.name}
                      </span>
                    ))}

                    {expenseCategories.length === 0 && (
                      <p className="text-sm text-slate-500">
                        No expense categories yet.
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
              <h3 className="mb-5 text-xl font-semibold">
                {form.id ? "Edit Transaction" : "Add Transaction"}
              </h3>

              <form
                onSubmit={saveTransaction}
                className="grid gap-4 md:grid-cols-2"
              >
                <div>
                  <label htmlFor="tx-title" className="mb-2 block text-sm font-medium">
                    Title
                  </label>
                  <input
                    id="tx-title"
                    required
                    minLength={2}
                    maxLength={100}
                    className={inputClass}
                    value={form.title}
                    placeholder="e.g. Monthly Salary"
                    onChange={e => setForm({
                      ...form, title: e.target.value,
                    })}
                  />
                </div>

                <div>
                  <label htmlFor="tx-amount" className="mb-2 block text-sm font-medium">
                    Amount (LKR)
                  </label>
                  <input
                    id="tx-amount"
                    required
                    type="number"
                    min="0.01"
                    max="9999999999.99"
                    step="0.01"
                    className={inputClass}
                    value={form.amount}
                    onChange={e => setForm({
                      ...form, amount: e.target.value,
                    })}
                  />
                </div>

                <div>
                  <label htmlFor="tx-type" className="mb-2 block text-sm font-medium">
                    Type
                  </label>
                  <select
                    id="tx-type"
                    className={inputClass}
                    value={form.type}
                    onChange={e => setForm({
                      ...form,
                      type: e.target.value as Type,
                      categoryId: "",
                    })}
                  >
                    <option value="EXPENSE">Expense</option>
                    <option value="INCOME">Income</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="tx-category" className="mb-2 block text-sm font-medium">
                    Category
                  </label>
                  <select
                    id="tx-category"
                    required
                    className={inputClass}
                    value={form.categoryId}
                    onChange={e => setForm({
                      ...form, categoryId: e.target.value,
                    })}
                  >
                    <option value="">Select Category</option>
                    {availableCategories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  {availableCategories.length === 0 && (
                    <p className="mt-2 text-xs text-amber-600">
                      Please create a category first.
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="tx-date" className="mb-2 block text-sm font-medium">
                    Date
                  </label>
                  <input
                    id="tx-date"
                    required
                    type="date"
                    className={inputClass}
                    value={form.date}
                    onChange={e => setForm({
                      ...form, date: e.target.value,
                    })}
                  />
                </div>

                <div>
                  <label htmlFor="tx-note" className="mb-2 block text-sm font-medium">
                    Note
                  </label>
                  <input
                    id="tx-note"
                    maxLength={500}
                    className={inputClass}
                    placeholder="Optional note"
                    value={form.note}
                    onChange={e => setForm({
                      ...form, note: e.target.value,
                    })}
                  />
                </div>

                <div className="flex flex-wrap gap-3 md:col-span-2">
                  <button
                    type="submit"
                    disabled={saving || availableCategories.length === 0}
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
                      onClick={() => setForm(emptyForm())}
                      className="rounded-xl border px-5 py-3 text-sm"
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
                    {transactions.map(t => (
                      <tr key={t.id} className="border-b border-slate-100">
                        <td className="p-4 font-medium">{t.title}</td>
                        <td className="p-4">{t.category.name}</td>
                        <td className="p-4">{t.date.slice(0, 10)}</td>

                        <td className="p-4">
                          <span className={
                            t.type === "INCOME"
                              ? "text-emerald-600"
                              : "text-rose-600"
                          }>
                            {t.type}
                          </span>
                        </td>

                        <td className="p-4 font-semibold">
                          {money(Number(t.amount))}
                        </td>

                        <td className="p-4">
                          <div className="flex gap-3">
                            <button
                              type="button"
                              disabled={saving}
                              aria-label={`Edit ${t.title}`}
                              className="text-blue-600"
                              onClick={() => editTransaction(t)}
                            >
                              <Pencil size={18} />
                            </button>

                            <button
                              type="button"
                              disabled={saving}
                              aria-label={`Delete ${t.title}`}
                              className="text-rose-600"
                              onClick={() => deleteTransaction(t.id)}
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
                    No transactions yet.
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

function SummaryCard({
  title, value, icon, color,
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
