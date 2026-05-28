from flask import Flask, render_template, request, redirect, flash, session
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3
import calendar
from datetime import datetime
import pandas as pd
import numpy as np

app = Flask(__name__)

app.secret_key = "expense_secret_key"

# =========================
# CREATE DATABASE
# =========================

def init_db():

    conn = sqlite3.connect("expenses.db")

    cursor = conn.cursor()

    # USERS TABLE

    cursor.execute("""

        CREATE TABLE IF NOT EXISTS users(

            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            email TEXT,
            password TEXT

        )

    """)

    # EXPENSE TABLE

    cursor.execute("""

        CREATE TABLE IF NOT EXISTS expenses(

            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            title TEXT,
            amount INTEGER,
            category TEXT,
            date TEXT,
            time TEXT

        )

    """)

    # SETTINGS TABLE

    cursor.execute("""

        CREATE TABLE IF NOT EXISTS settings(

            id INTEGER PRIMARY KEY,
            budget INTEGER,
            month INTEGER,
            year INTEGER

        )

    """)

    conn.commit()

    conn.close()

# =========================
# SIGNUP PAGE
# =========================

@app.route("/signup", methods=["GET", "POST"])
def signup():

    if request.method == "POST":

        username = request.form["username"]

        email = request.form["email"]

        password = request.form["password"]

        # HASH PASSWORD

        hashed_password = generate_password_hash(password)

        conn = sqlite3.connect("expenses.db")

        cursor = conn.cursor()

        cursor.execute(

            """

            INSERT INTO users(

                username,
                email,
                password

            )

            VALUES (?, ?, ?)

            """,

            (

                username,
                email,
                hashed_password

            )

        )

        conn.commit()

        conn.close()

        flash("Account Created Successfully!")

        return redirect("/login")

    return render_template("signup.html")

# =========================
# LOGIN PAGE
# =========================

@app.route("/login", methods=["GET", "POST"])
def login():

    if request.method == "POST":

        email = request.form["email"]

        password = request.form["password"]

        conn = sqlite3.connect("expenses.db")

        cursor = conn.cursor()

        cursor.execute(

            "SELECT * FROM users WHERE email=?",

            (email,)

        )

        user = cursor.fetchone()

        conn.close()

        if user:

            stored_password = user[3]

            if check_password_hash(

                stored_password,
                password

            ):

                session["user_id"] = user[0]

                session["username"] = user[1]

                flash("Login Successful!")

                return redirect("/")

        flash("Invalid Email or Password")

    return render_template("login.html")

# =========================
# LOGOUT
# =========================

@app.route("/logout")
def logout():

    session.clear()

    flash("Logged Out Successfully!")

    return redirect("/login")

# =========================
# HOME PAGE
# =========================

@app.route("/")
def home():

    # LOGIN CHECK

    if "user_id" not in session:

        return redirect("/login")

    user_id = session["user_id"]

    conn = sqlite3.connect("expenses.db")

    # FETCH USER EXPENSES

    df = pd.read_sql_query(

        f"SELECT * FROM expenses WHERE user_id={user_id}",

        conn

    )

    expenses = df.values.tolist()

    # TOTAL SPENT

    if len(df) > 0:

        total_spent = df["amount"].sum()

    else:

        total_spent = 0

    # SETTINGS

    cursor = conn.cursor()

    cursor.execute(

        "SELECT budget, month, year FROM settings WHERE id=1"

    )

    settings = cursor.fetchone()

    if settings:

        budget = settings[0]

        selected_month = settings[1]

        selected_year = settings[2]

    else:

        budget = 0

        selected_month = datetime.now().month

        selected_year = datetime.now().year

    # REMAINING

    remaining = budget - total_spent

    # DAYS LEFT

    total_days = calendar.monthrange(

        selected_year,
        selected_month

    )[1]

    today = datetime.now()

    if (

        today.month == selected_month and
        today.year == selected_year

    ):

        days_left = total_days - today.day

    else:

        days_left = total_days

    # =========================
    # AI INSIGHTS
    # =========================

    insights = []

    if len(df) > 0:

        category_totals = df.groupby(

            "category"

        )["amount"].sum()

        highest_category = category_totals.idxmax()

        highest_amount = category_totals.max()

        insights.append(

            f"Highest spending category is {highest_category} (₹{highest_amount})"

        )

        # FOOD ANALYSIS

        if "Food & Dining" in category_totals:

            if category_totals["Food & Dining"] > 5000:

                insights.append(

                    "Food expenses are very high this month"

                )

        # SHOPPING ANALYSIS

        if "Shopping" in category_totals:

            if category_totals["Shopping"] > 3000:

                insights.append(

                    "Shopping expenses should be reduced"

                )

        # ENTERTAINMENT

        if "Entertainment" in category_totals:

            insights.append(

                "Entertainment spending detected"

            )

        # BUDGET WARNING

        if budget > 0:

            used_percent = (total_spent / budget) * 100

            if used_percent > 80:

                insights.append(

                    "Warning: You already used more than 80% of your budget"

                )

            else:

                insights.append(

                    "Your budget usage is healthy"

                )

    else:

        insights.append(

            "Add expenses to generate AI insights"

        )

    conn.close()

    return render_template(

        "index.html",

        budget=budget,

        remaining=remaining,

        days_left=days_left,

        insights=insights,

        username=session["username"]

    )

# =========================
# ADD EXPENSE
# =========================

@app.route("/add", methods=["POST"])
def add_expense():

    if "user_id" not in session:

        return redirect("/login")

    user_id = session["user_id"]

    title = request.form["title"]

    amount = request.form["amount"]

    category = request.form["category"]

    # DATE & TIME

    now = datetime.now()

    current_date = now.strftime("%d %B %Y")

    current_time = now.strftime("%I:%M %p")

    conn = sqlite3.connect("expenses.db")

    cursor = conn.cursor()

    cursor.execute(

        """

        INSERT INTO expenses(

            user_id,
            title,
            amount,
            category,
            date,
            time

        )

        VALUES (?, ?, ?, ?, ?, ?)

        """,

        (

            user_id,
            title,
            amount,
            category,
            current_date,
            current_time

        )

    )

    conn.commit()

    conn.close()

    flash("Expense Added Successfully!")

    return redirect("/")

# =========================
# DELETE EXPENSE
# =========================

@app.route("/delete/<int:id>")
def delete_expense(id):

    conn = sqlite3.connect("expenses.db")

    cursor = conn.cursor()

    cursor.execute(

        "DELETE FROM expenses WHERE id=?",

        (id,)

    )

    conn.commit()

    conn.close()

    flash("Expense Deleted Successfully!")

    return redirect("/expenses")

# =========================
# SAVE SETTINGS
# =========================

@app.route("/set_budget", methods=["POST"])
def set_budget():

    budget = request.form["budget"]

    month = request.form["month"]

    year = request.form["year"]

    conn = sqlite3.connect("expenses.db")

    cursor = conn.cursor()

    cursor.execute("DELETE FROM settings")

    cursor.execute(

        """

        INSERT INTO settings(

            id,
            budget,
            month,
            year

        )

        VALUES (1, ?, ?, ?)

        """,

        (

            budget,
            month,
            year

        )

    )

    conn.commit()

    conn.close()

    flash("Budget Updated Successfully!")

    return redirect("/")

# =========================
# EXPENSE PAGE
# =========================

@app.route("/expenses")
def expenses_page():

    if "user_id" not in session:

        return redirect("/login")

    user_id = session["user_id"]

    conn = sqlite3.connect("expenses.db")

    cursor = conn.cursor()

    cursor.execute(

        """

        SELECT * FROM expenses

        WHERE user_id=?

        ORDER BY id DESC

        """,

        (user_id,)

    )

    expenses = cursor.fetchall()

    conn.close()

    return render_template(

        "expenses.html",

        expenses=expenses

    )

# =========================
# CHARTS PAGE
# =========================

@app.route("/charts")
def charts_page():

    if "user_id" not in session:

        return redirect("/login")

    user_id = session["user_id"]

    conn = sqlite3.connect("expenses.db")

    cursor = conn.cursor()

    cursor.execute(

        """

        SELECT category, SUM(amount)

        FROM expenses

        WHERE user_id=?

        GROUP BY category

        """,

        (user_id,)

    )

    data = cursor.fetchall()

    conn.close()

    categories = []

    amounts = []

    for row in data:

        categories.append(row[0])

        amounts.append(row[1])

    return render_template(

        "charts.html",

        categories=categories,

        amounts=amounts

    )

# =========================
# RUN APP
# =========================

if __name__ == "__main__":

    init_db()

    app.run(debug=True)