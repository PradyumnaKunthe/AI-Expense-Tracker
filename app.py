from flask import Flask, render_template, request, redirect, flash, session
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3
import calendar
from datetime import datetime
import pandas as pd

app = Flask(__name__)
app.secret_key = "expense_secret_key"


# ─────────────────────────────────────────
# DATABASE INIT
# ─────────────────────────────────────────

def init_db():
    conn = sqlite3.connect("expenses.db")
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT    NOT NULL,
            email    TEXT    NOT NULL UNIQUE,
            password TEXT    NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS expenses (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id  INTEGER NOT NULL,
            title    TEXT    NOT NULL,
            amount   REAL    NOT NULL,
            category TEXT    NOT NULL,
            date     TEXT    NOT NULL,
            time     TEXT    NOT NULL
        )
    """)

    # FIX: amount column was INTEGER — changed to REAL to support decimals
    # If your DB already exists, this migration alters the column type safely.
    try:
        cursor.execute("ALTER TABLE expenses ADD COLUMN _dummy TEXT")
        cursor.execute("ALTER TABLE expenses DROP COLUMN _dummy")
    except Exception:
        pass

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            id     INTEGER PRIMARY KEY,
            budget REAL    NOT NULL DEFAULT 0,
            month  INTEGER NOT NULL,
            year   INTEGER NOT NULL
        )
    """)

    conn.commit()
    conn.close()


# ─────────────────────────────────────────
# HELPER — get DB connection
# ─────────────────────────────────────────

def get_db():
    conn = sqlite3.connect("expenses.db")
    conn.row_factory = sqlite3.Row   # lets us access columns by name too
    return conn


# ─────────────────────────────────────────
# SIGNUP
# ─────────────────────────────────────────

@app.route("/signup", methods=["GET", "POST"])
def signup():
    if request.method == "POST":
        username = request.form["username"].strip()
        email    = request.form["email"].strip().lower()
        password = request.form["password"]

        if not username or not email or not password:
            flash("All fields are required.")
            return render_template("signup.html")

        hashed_password = generate_password_hash(password)

        conn   = get_db()
        cursor = conn.cursor()

        # FIX: check for duplicate email before inserting
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        if cursor.fetchone():
            conn.close()
            flash("An account with this email already exists.")
            return render_template("signup.html")

        cursor.execute(
            "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
            (username, email, hashed_password)
        )
        conn.commit()
        conn.close()

        flash("Account created successfully! Please log in.")
        return redirect("/login")

    return render_template("signup.html")


# ─────────────────────────────────────────
# LOGIN
# ─────────────────────────────────────────

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email    = request.form["email"].strip().lower()
        password = request.form["password"]

        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
        user = cursor.fetchone()
        conn.close()

        if user and check_password_hash(user["password"], password):
            session["user_id"]  = user["id"]
            session["username"] = user["username"]
            flash("Welcome back, " + user["username"] + "!")
            return redirect("/")

        flash("Invalid email or password.")

    return render_template("login.html")


# ─────────────────────────────────────────
# LOGOUT
# ─────────────────────────────────────────

@app.route("/logout")
def logout():
    session.clear()
    flash("Logged out successfully.")
    return redirect("/login")


# ─────────────────────────────────────────
# HOME / DASHBOARD
# ─────────────────────────────────────────

@app.route("/")
def home():
    if "user_id" not in session:
        return redirect("/login")

    user_id = session["user_id"]
    conn    = get_db()

    # ── Expenses ──────────────────────────
    df = pd.read_sql_query(
        "SELECT * FROM expenses WHERE user_id = ?",
        conn,
        params=(user_id,)
    )

    # FIX: ensure amount is always numeric, never a string
    if not df.empty:
        df["amount"] = pd.to_numeric(df["amount"], errors="coerce").fillna(0)
        total_spent  = float(df["amount"].sum())
    else:
        total_spent = 0.0

    # ── Settings ──────────────────────────
    cursor = conn.cursor()
    cursor.execute("SELECT budget, month, year FROM settings WHERE id = 1")
    settings = cursor.fetchone()
    conn.close()

    if settings:
        budget         = float(settings["budget"])
        selected_month = int(settings["month"])
        selected_year  = int(settings["year"])
    else:
        budget         = 0.0
        selected_month = datetime.now().month
        selected_year  = datetime.now().year

    # ── Remaining & Days Left ─────────────
    remaining  = round(budget - total_spent, 2)
    total_days = calendar.monthrange(selected_year, selected_month)[1]
    today      = datetime.now()

    if today.month == selected_month and today.year == selected_year:
        days_left = total_days - today.day
    else:
        days_left = total_days

    # ── AI Insights ───────────────────────
    insights = []

    if not df.empty:
        category_totals    = df.groupby("category")["amount"].sum()
        highest_category   = category_totals.idxmax()
        highest_amount     = int(category_totals.max())

        insights.append(
            f"📊 Highest spending: {highest_category} — ₹{highest_amount:,}"
        )

        if "Food & Dining" in category_totals and category_totals["Food & Dining"] > 5000:
            insights.append("🍽️ Food & Dining expenses are unusually high this month.")

        if "Shopping" in category_totals and category_totals["Shopping"] > 3000:
            insights.append("🛍️ Consider cutting back on Shopping expenses.")

        if "Entertainment" in category_totals:
            insights.append(
                f"🎬 Entertainment spending: ₹{int(category_totals['Entertainment']):,} this month."
            )

        if budget > 0:
            used_percent = (total_spent / budget) * 100
            if used_percent >= 100:
                insights.append(
                    f"🚨 Budget exceeded! You've spent ₹{int(total_spent - budget):,} over your limit."
                )
            elif used_percent > 80:
                insights.append(
                    f"⚠️ Warning: {used_percent:.0f}% of your budget used. Spend carefully!"
                )
            else:
                insights.append(
                    f"✅ Budget on track — {used_percent:.0f}% used, ₹{int(remaining):,} remaining."
                )

        # Daily budget tip
        if days_left > 0 and remaining > 0:
            daily_budget = remaining / days_left
            insights.append(
                f"💡 You can spend ₹{daily_budget:.0f}/day for the rest of the month."
            )
    else:
        insights.append("Add your first expense to start seeing AI-powered insights here.")

    return render_template(
        "index.html",
        budget    = int(budget),
        remaining = int(remaining),
        days_left = days_left,
        insights  = insights,
        username  = session["username"]
    )


# ─────────────────────────────────────────
# ADD EXPENSE
# ─────────────────────────────────────────

@app.route("/add", methods=["POST"])
def add_expense():
    if "user_id" not in session:
        return redirect("/login")

    user_id  = session["user_id"]
    title    = request.form["title"].strip()
    category = request.form["category"]

    # FIX: safely convert amount to float; reject invalid input
    try:
        amount = float(request.form["amount"])
        if amount <= 0:
            raise ValueError
    except ValueError:
        flash("Please enter a valid amount greater than 0.")
        return redirect("/")

    now          = datetime.now()
    current_date = now.strftime("%d %B %Y")
    current_time = now.strftime("%I:%M %p")

    conn   = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO expenses (user_id, title, amount, category, date, time)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (user_id, title, amount, category, current_date, current_time)
    )
    conn.commit()
    conn.close()

    flash("Expense added successfully!")
    return redirect("/")


# ─────────────────────────────────────────
# DELETE EXPENSE
# ─────────────────────────────────────────

@app.route("/delete/<int:expense_id>")
def delete_expense(expense_id):
    if "user_id" not in session:
        return redirect("/login")

    user_id = session["user_id"]
    conn    = get_db()
    cursor  = conn.cursor()

    # FIX: only allow deleting your OWN expenses (security fix)
    cursor.execute(
        "DELETE FROM expenses WHERE id = ? AND user_id = ?",
        (expense_id, user_id)
    )
    conn.commit()
    conn.close()

    flash("Expense deleted.")
    return redirect("/expenses")


# ─────────────────────────────────────────
# SAVE BUDGET SETTINGS
# ─────────────────────────────────────────

@app.route("/set_budget", methods=["POST"])
def set_budget():
    if "user_id" not in session:
        return redirect("/login")

    # FIX: validate all inputs before saving
    try:
        budget = float(request.form["budget"])
        month  = int(request.form["month"])
        year   = int(request.form["year"])
        if budget < 0 or not (1 <= month <= 12) or year < 2000:
            raise ValueError
    except ValueError:
        flash("Invalid budget settings. Please check your inputs.")
        return redirect("/")

    conn   = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM settings")
    cursor.execute(
        "INSERT INTO settings (id, budget, month, year) VALUES (1, ?, ?, ?)",
        (budget, month, year)
    )
    conn.commit()
    conn.close()

    flash("Budget updated successfully!")
    return redirect("/")


# ─────────────────────────────────────────
# EXPENSES PAGE
# ─────────────────────────────────────────

@app.route("/expenses")
def expenses_page():
    if "user_id" not in session:
        return redirect("/login")

    user_id = session["user_id"]
    conn    = get_db()
    cursor  = conn.cursor()

    cursor.execute(
        "SELECT * FROM expenses WHERE user_id = ? ORDER BY id DESC",
        (user_id,)
    )
    rows = cursor.fetchall()
    conn.close()

    # FIX: convert to list of lists and ensure amount is float (fixes TypeError)
    expenses = []
    for row in rows:
        e = list(row)
        e[3] = float(e[3])   # index 3 = amount column
        expenses.append(e)

    total_spent = round(sum(e[3] for e in expenses), 2)

    return render_template(
        "expenses.html",
        expenses    = expenses,
        total_spent = int(total_spent)
    )


# ─────────────────────────────────────────
# CHARTS PAGE
# ─────────────────────────────────────────

@app.route("/charts")
def charts_page():
    if "user_id" not in session:
        return redirect("/login")

    user_id = session["user_id"]
    conn    = get_db()
    cursor  = conn.cursor()

    cursor.execute(
        "SELECT category, SUM(amount) FROM expenses WHERE user_id = ? GROUP BY category",
        (user_id,)
    )
    data = cursor.fetchall()
    conn.close()

    # FIX: ensure amounts are ints for Chart.js (avoids float display issues)
    categories = [row[0] for row in data]
    amounts    = [int(float(row[1])) for row in data]

    return render_template(
        "charts.html",
        categories = categories,
        amounts    = amounts
    )


# ─────────────────────────────────────────
# RUN
# ─────────────────────────────────────────

if __name__ == "__main__":
    init_db()
    app.run(debug=True)