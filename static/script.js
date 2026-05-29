/* =============================================================
   AI EXPENSE TRACKER — script.js
   Covers: Theme, Navbar, Dashboard, Expenses, Charts, Budget
   ============================================================= */


/* =============================================================
   1. UTILITIES
   ============================================================= */

/**
 * Safe querySelector — returns null instead of throwing
 */
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

/**
 * Format a number as Indian Rupee string
 * e.g. 12500 → "₹12,500"
 */
function formatINR(amount) {
    return "₹" + Number(amount).toLocaleString("en-IN", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
}

/**
 * Get today's date as YYYY-MM-DD
 */
function todayISO() {
    return new Date().toISOString().split("T")[0];
}

/**
 * How many days are left in the current month
 */
function daysLeftInMonth() {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return lastDay - now.getDate();
}

/**
 * Debounce a function call
 */
function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

/**
 * Show a toast notification
 * type: "success" | "error" | "info" | "warning"
 */
function showToast(message, type = "success") {
    const existing = $("#toast-container");
    const container = existing || (() => {
        const el = document.createElement("div");
        el.id = "toast-container";
        el.style.cssText = `
            position: fixed; bottom: 24px; right: 24px;
            z-index: 9999; display: flex; flex-direction: column; gap: 10px;
        `;
        document.body.appendChild(el);
        return el;
    })();

    const icons = {
        success: "bi-check-circle-fill",
        error:   "bi-x-circle-fill",
        info:    "bi-info-circle-fill",
        warning: "bi-exclamation-triangle-fill"
    };
    const colors = {
        success: "#06D6A0",
        error:   "#FF6B6B",
        info:    "#7C6FFF",
        warning: "#FFD166"
    };

    const toast = document.createElement("div");
    toast.style.cssText = `
        display: flex; align-items: center; gap: 10px;
        background: rgba(20,20,30,0.95);
        border: 1px solid rgba(255,255,255,0.1);
        border-left: 3px solid ${colors[type]};
        border-radius: 10px;
        padding: 12px 18px;
        font-size: 0.875rem;
        color: #f0eff8;
        min-width: 240px;
        max-width: 340px;
        backdrop-filter: blur(12px);
        transform: translateX(120%);
        transition: transform 0.35s cubic-bezier(.34,1.56,.64,1), opacity 0.3s;
        opacity: 0;
        box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    `;
    toast.innerHTML = `
        <i class="bi ${icons[type]}" style="color:${colors[type]};font-size:1rem;flex-shrink:0;"></i>
        <span>${message}</span>
    `;
    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.transform = "translateX(0)";
        toast.style.opacity = "1";
    });

    setTimeout(() => {
        toast.style.transform = "translateX(120%)";
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 400);
    }, 3200);
}

/**
 * Confirm dialog (custom, non-blocking)
 * Returns a Promise<boolean>
 */
function confirmDialog(message) {
    return new Promise(resolve => {
        const overlay = document.createElement("div");
        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 10000;
            background: rgba(0,0,0,0.6);
            display: flex; align-items: center; justify-content: center;
            backdrop-filter: blur(4px);
            animation: fadeInOverlay 0.2s ease;
        `;

        overlay.innerHTML = `
            <div style="
                background: #13131a;
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 16px;
                padding: 28px 32px;
                max-width: 360px;
                width: 90%;
                text-align: center;
                animation: scaleIn 0.25s cubic-bezier(.34,1.56,.64,1);
            ">
                <div style="font-size:2rem;margin-bottom:12px;">🗑️</div>
                <p style="color:#f0eff8;font-size:0.95rem;margin-bottom:20px;line-height:1.5;">${message}</p>
                <div style="display:flex;gap:10px;justify-content:center;">
                    <button id="confirmNo" style="
                        padding:9px 24px; border-radius:8px; border:1px solid rgba(255,255,255,0.15);
                        background:transparent; color:#f0eff8; cursor:pointer; font-size:0.875rem;
                        transition:background 0.2s;
                    ">Cancel</button>
                    <button id="confirmYes" style="
                        padding:9px 24px; border-radius:8px; border:none;
                        background:#FF6B6B; color:white; cursor:pointer; font-size:0.875rem;
                        font-weight:500; transition:opacity 0.2s;
                    ">Delete</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        overlay.querySelector("#confirmNo").onclick = () => { overlay.remove(); resolve(false); };
        overlay.querySelector("#confirmYes").onclick = () => { overlay.remove(); resolve(true); };
        overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } };
    });
}


/* =============================================================
   2. DARK / LIGHT MODE
   ============================================================= */

function initTheme() {
    const toggleBtn = $("#themeToggle");
    if (!toggleBtn) return;

    const savedTheme = localStorage.getItem("theme") || "dark";
    applyTheme(savedTheme, false);

    toggleBtn.addEventListener("click", () => {
        const isLight = document.body.classList.contains("light-mode");
        applyTheme(isLight ? "dark" : "light", true);
    });
}

function applyTheme(theme, animate = true) {
    const isLight = theme === "light";
    const toggleBtn = $("#themeToggle");

    document.body.classList.toggle("light-mode", isLight);

    if (toggleBtn) {
        if (animate) {
            toggleBtn.style.transform = "scale(0.85) rotate(20deg)";
            setTimeout(() => { toggleBtn.style.transform = ""; }, 250);
        }
        const iconEl = toggleBtn.querySelector("i") || toggleBtn;
        if (iconEl.tagName === "I") {
            iconEl.className = isLight ? "bi bi-moon-stars-fill" : "bi bi-sun-fill";
        } else {
            toggleBtn.textContent = isLight ? "🌙" : "☀️";
        }
        toggleBtn.setAttribute("aria-label", isLight ? "Switch to dark mode" : "Switch to light mode");
        toggleBtn.setAttribute("title", isLight ? "Switch to dark mode" : "Switch to light mode");
    }

    localStorage.setItem("theme", theme);
}


/* =============================================================
   3. NAVBAR — active link + mobile menu
   ============================================================= */

function initNavbar() {
    const currentPath = window.location.pathname;

    $$(".navbar a, .nav-link").forEach(link => {
        const href = link.getAttribute("href");
        if (!href) return;

        const isHome = (href === "/" && (currentPath === "/" || currentPath === "/index"));
        const isMatch = href !== "/" && currentPath.startsWith(href);

        if (isHome || isMatch) {
            link.classList.add("active");
            link.setAttribute("aria-current", "page");
        }
    });

    // Mobile hamburger (if present)
    const hamburger = $("#navbarToggler");
    const navMenu   = $("#navbarMenu");
    if (hamburger && navMenu) {
        hamburger.addEventListener("click", () => {
            const open = navMenu.classList.toggle("show");
            hamburger.setAttribute("aria-expanded", open);
        });

        // Close on outside click
        document.addEventListener("click", e => {
            if (!hamburger.contains(e.target) && !navMenu.contains(e.target)) {
                navMenu.classList.remove("show");
                hamburger.setAttribute("aria-expanded", "false");
            }
        });
    }
}


/* =============================================================
   4. DASHBOARD — stats, budget, savings, days left
   ============================================================= */

function initDashboard() {
    if (!$("#dashboard-page, .dashboard-stats")) return;

    animateCounters();
    initBudgetProgressBar();
    updateDaysLeftCard();
    initSavingsIndicator();
}

/**
 * Animate number counters on dashboard cards
 * Requires data-target attribute on the element
 */
function animateCounters() {
    $$("[data-counter]").forEach(el => {
        const target = parseFloat(el.dataset.counter || el.textContent.replace(/[^0-9.]/g, ""));
        if (isNaN(target)) return;

        const prefix = el.dataset.prefix || "";
        const suffix = el.dataset.suffix || "";
        const duration = 900;
        const start = performance.now();

        function tick(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // Ease-out-expo
            const eased = 1 - Math.pow(2, -10 * progress);
            const current = Math.round(target * eased);
            el.textContent = prefix + current.toLocaleString("en-IN") + suffix;
            if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    });
}

/**
 * Draw a progress bar showing budget used vs remaining
 */
function initBudgetProgressBar() {
    const bar    = $("#budget-progress-bar");
    const label  = $("#budget-progress-label");
    if (!bar) return;

    const budget  = parseFloat(bar.dataset.budget  || 0);
    const spent   = parseFloat(bar.dataset.spent   || 0);
    if (budget <= 0) return;

    const pct = Math.min((spent / budget) * 100, 100);

    // Animate fill
    bar.style.width = "0%";
    setTimeout(() => {
        bar.style.transition = "width 1s cubic-bezier(0.4,0,0.2,1)";
        bar.style.width = pct.toFixed(1) + "%";
    }, 200);

    // Color feedback
    if (pct >= 90)      bar.classList.add("bg-danger");
    else if (pct >= 70) bar.classList.add("bg-warning");
    else                bar.classList.add("bg-success");

    if (label) label.textContent = pct.toFixed(0) + "% used";
}

/**
 * Update days-left card dynamically
 */
function updateDaysLeftCard() {
    const el = $("#days-left-value");
    if (!el) return;
    el.textContent = daysLeftInMonth();
}

/**
 * Savings indicator — color + icon based on value
 */
function initSavingsIndicator() {
    const el    = $("#savings-value");
    const icon  = $("#savings-icon");
    if (!el) return;

    const val = parseFloat(el.dataset.savings || el.textContent.replace(/[^0-9.-]/g, ""));
    if (isNaN(val)) return;

    if (val > 0) {
        el.style.color = "#06D6A0";
        if (icon) icon.className = "bi bi-arrow-up-circle-fill";
    } else if (val < 0) {
        el.style.color = "#FF6B6B";
        if (icon) icon.className = "bi bi-arrow-down-circle-fill";
    } else {
        el.style.color = "#FFD166";
        if (icon) icon.className = "bi bi-dash-circle-fill";
    }
}


/* =============================================================
   5. ADD EXPENSE FORM — validation + UX
   ============================================================= */

function initExpenseForm() {
    const form = $("#expense-form");
    if (!form) return;

    const titleInput    = $("#expense-title");
    const amountInput   = $("#expense-amount");
    const categoryInput = $("#expense-category");
    const spentOnInput  = $("#expense-spent-on");
    const submitBtn     = $("#expense-submit");

    // Real-time validation
    if (amountInput) {
        amountInput.addEventListener("input", () => {
            const val = parseFloat(amountInput.value);
            if (amountInput.value && (isNaN(val) || val <= 0)) {
                setFieldError(amountInput, "Enter a valid amount greater than 0");
            } else {
                clearFieldError(amountInput);
                // Live preview of formatted amount
                const preview = $("#amount-preview");
                if (preview && val > 0) {
                    preview.textContent = formatINR(val);
                    preview.style.opacity = "1";
                }
            }
        });
    }

    if (titleInput) {
        titleInput.addEventListener("input", () => {
            if (titleInput.value.trim().length < 2) {
                setFieldError(titleInput, "Title must be at least 2 characters");
            } else {
                clearFieldError(titleInput);
            }
        });
    }

    // Form submit
    form.addEventListener("submit", e => {
        let valid = true;

        if (!titleInput?.value.trim()) {
            setFieldError(titleInput, "Title is required");
            valid = false;
        }
        if (!amountInput?.value || parseFloat(amountInput.value) <= 0) {
            setFieldError(amountInput, "Enter a valid amount");
            valid = false;
        }
        if (!categoryInput?.value) {
            setFieldError(categoryInput, "Select a category");
            valid = false;
        }

        if (!valid) {
            e.preventDefault();
            showToast("Please fix the errors before submitting.", "error");
            return;
        }

        // Loading state
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Adding...`;
        }
    });
}

function setFieldError(input, message) {
    if (!input) return;
    input.classList.add("is-invalid");
    input.classList.remove("is-valid");
    let feedback = input.parentElement.querySelector(".invalid-feedback");
    if (!feedback) {
        feedback = document.createElement("div");
        feedback.className = "invalid-feedback";
        input.parentElement.appendChild(feedback);
    }
    feedback.textContent = message;
}

function clearFieldError(input) {
    if (!input) return;
    input.classList.remove("is-invalid");
    input.classList.add("is-valid");
}


/* =============================================================
   6. EXPENSES PAGE — search, filter, delete
   ============================================================= */

function initExpensesPage() {
    if (!$("#expenses-table-body, .expenses-list")) return;

    initExpenseSearch();
    initExpenseFilters();
    initExpenseDelete();
    initExpenseSortHeaders();
}

/**
 * Live search across title, category, spent-on columns
 */
function initExpenseSearch() {
    const searchInput = $("#expense-search");
    if (!searchInput) return;

    const handler = debounce(() => {
        const query = searchInput.value.trim().toLowerCase();
        const rows  = $$(".expense-row");
        let visible = 0;

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            const match = !query || text.includes(query);
            row.style.display = match ? "" : "none";
            if (match) visible++;
        });

        updateExpenseCount(visible);
        toggleEmptyState(visible === 0);
    }, 250);

    searchInput.addEventListener("input", handler);

    // Clear button
    const clearBtn = $("#search-clear");
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            searchInput.value = "";
            handler();
            searchInput.focus();
        });
    }
}

/**
 * Category + merchant filter dropdowns
 */
function initExpenseFilters() {
    const categoryFilter = $("#filter-category");
    const merchantFilter = $("#filter-merchant");

    function applyFilters() {
        const cat  = categoryFilter?.value || "";
        const merch = merchantFilter?.value || "";
        const rows = $$(".expense-row");
        let visible = 0;

        rows.forEach(row => {
            const rowCat   = row.dataset.category || "";
            const rowMerch = row.dataset.merchant  || "";
            const catMatch  = !cat   || rowCat.toLowerCase()   === cat.toLowerCase();
            const merchMatch = !merch || rowMerch.toLowerCase() === merch.toLowerCase();
            const show = catMatch && merchMatch;
            row.style.display = show ? "" : "none";
            if (show) visible++;
        });

        updateExpenseCount(visible);
        toggleEmptyState(visible === 0);
    }

    categoryFilter?.addEventListener("change", applyFilters);
    merchantFilter?.addEventListener("change", applyFilters);

    // Reset filters button
    const resetBtn = $("#reset-filters");
    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            if (categoryFilter) categoryFilter.value = "";
            if (merchantFilter) merchantFilter.value = "";
            applyFilters();
            showToast("Filters cleared", "info");
        });
    }
}

/**
 * Delete expense — confirm then submit
 */
function initExpenseDelete() {
    document.addEventListener("click", async e => {
        const deleteBtn = e.target.closest(".delete-expense-btn");
        if (!deleteBtn) return;

        e.preventDefault();
        const expenseId    = deleteBtn.dataset.id;
        const expenseTitle = deleteBtn.dataset.title || "this expense";

        const confirmed = await confirmDialog(
            `Delete "<strong>${expenseTitle}</strong>"? This cannot be undone.`
        );
        if (!confirmed) return;

        // Find and submit the hidden delete form for this expense
        const deleteForm = $(`#delete-form-${expenseId}`);
        if (deleteForm) {
            // Animate row out before submitting
            const row = deleteBtn.closest(".expense-row, tr");
            if (row) {
                row.style.transition = "opacity 0.3s, transform 0.3s";
                row.style.opacity = "0";
                row.style.transform = "translateX(30px)";
                setTimeout(() => deleteForm.submit(), 300);
            } else {
                deleteForm.submit();
            }
        } else {
            // Fallback: direct fetch
            try {
                const res = await fetch(`/delete_expense/${expenseId}`, { method: "POST" });
                if (res.ok) {
                    const row = deleteBtn.closest(".expense-row, tr");
                    if (row) {
                        row.style.transition = "opacity 0.3s, transform 0.3s";
                        row.style.opacity = "0";
                        row.style.transform = "translateX(30px)";
                        setTimeout(() => {
                            row.remove();
                            showToast("Expense deleted.", "success");
                            refreshExpenseStats();
                        }, 300);
                    }
                } else {
                    showToast("Failed to delete expense.", "error");
                }
            } catch {
                showToast("Network error. Please try again.", "error");
            }
        }
    });
}

/**
 * Sortable table headers — click to sort ascending/descending
 */
function initExpenseSortHeaders() {
    const headers = $$("th[data-sort]");
    if (!headers.length) return;

    let currentSort = { col: null, asc: true };

    headers.forEach(th => {
        th.style.cursor = "pointer";
        th.addEventListener("click", () => {
            const col = th.dataset.sort;
            currentSort.asc = currentSort.col === col ? !currentSort.asc : true;
            currentSort.col = col;

            headers.forEach(h => h.classList.remove("sort-asc", "sort-desc"));
            th.classList.add(currentSort.asc ? "sort-asc" : "sort-desc");

            sortExpenseRows(col, currentSort.asc);
        });
    });
}

function sortExpenseRows(col, asc) {
    const tbody  = $("#expenses-table-body");
    if (!tbody) return;
    const rows   = $$(".expense-row", tbody);

    rows.sort((a, b) => {
        const aVal = a.dataset[col] || a.querySelector(`[data-col="${col}"]`)?.textContent || "";
        const bVal = b.dataset[col] || b.querySelector(`[data-col="${col}"]`)?.textContent || "";

        const aNum = parseFloat(aVal.replace(/[^0-9.]/g, ""));
        const bNum = parseFloat(bVal.replace(/[^0-9.]/g, ""));

        if (!isNaN(aNum) && !isNaN(bNum)) {
            return asc ? aNum - bNum : bNum - aNum;
        }
        return asc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });

    rows.forEach(row => tbody.appendChild(row));
}

function updateExpenseCount(count) {
    const el = $("#expense-count");
    if (el) el.textContent = count + " expense" + (count !== 1 ? "s" : "");
}

function toggleEmptyState(show) {
    const el = $("#no-expenses-msg");
    if (el) el.style.display = show ? "block" : "none";
}

function refreshExpenseStats() {
    // Optional: re-fetch totals from the server via AJAX and update the DOM
    fetch("/api/stats")
        .then(r => r.json())
        .then(data => {
            const totalEl = $("#total-expenses-value");
            if (totalEl && data.total) totalEl.textContent = formatINR(data.total);
        })
        .catch(() => {});
}


/* =============================================================
   7. BUDGET SETTINGS FORM
   ============================================================= */

function initBudgetForm() {
    const form = $("#budget-form");
    if (!form) return;

    const budgetInput = $("#budget-amount");
    const submitBtn   = $("#budget-submit");

    if (budgetInput) {
        budgetInput.addEventListener("input", () => {
            const val = parseFloat(budgetInput.value);
            const preview = $("#budget-preview");
            if (preview) {
                preview.textContent = (!isNaN(val) && val > 0) ? formatINR(val) : "";
            }
        });
    }

    form.addEventListener("submit", e => {
        const val = parseFloat(budgetInput?.value);
        if (!val || val <= 0) {
            e.preventDefault();
            setFieldError(budgetInput, "Enter a valid budget amount");
            showToast("Budget must be greater than ₹0", "error");
            return;
        }
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Saving...`;
        }
    });
}


/* =============================================================
   8. CHARTS PAGE — color palette injection
   ============================================================= */

/**
 * Shared color palette for all Chart.js charts in the app.
 * Call this from your charts.html inline script instead of
 * hardcoding colors there.
 */
window.CHART_COLORS = [
    "#7C6FFF", "#FF6B6B", "#06D6A0", "#FFD166",
    "#118AB2", "#FF9A3C", "#C77DFF", "#4CC9F0",
    "#F72585", "#7FD1AE", "#E9C46A", "#264653"
];

window.CHART_DEFAULTS = {
    borderColor: "#0A0A0F",
    borderWidth: 3,
    hoverOffset: 10,
};

/**
 * Build standard Chart.js tooltip config (dark themed)
 */
window.buildTooltipConfig = (prefix = "₹") => ({
    backgroundColor: "rgba(13,13,20,0.95)",
    titleColor: "#f0eff8",
    bodyColor: "rgba(240,239,248,0.7)",
    borderColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    padding: 12,
    cornerRadius: 8,
    callbacks: {
        label: ctx => ` ${prefix}${Number(ctx.parsed.y ?? ctx.parsed).toLocaleString("en-IN")}`
    }
});

/**
 * Build standard scale config for dark-themed bar/line charts
 */
window.buildScaleConfig = () => ({
    x: {
        ticks: { color: "rgba(255,255,255,0.4)", font: { size: 11 } },
        grid:  { color: "rgba(255,255,255,0.04)" }
    },
    y: {
        ticks: {
            color: "rgba(255,255,255,0.4)",
            font: { size: 11 },
            callback: v => "₹" + Number(v).toLocaleString("en-IN")
        },
        grid: { color: "rgba(255,255,255,0.04)" }
    }
});


/* =============================================================
   9. AI INSIGHTS — dynamic generation
   ============================================================= */

function initAIInsights() {
    const container = $("#ai-insights-container");
    if (!container) return;

    // Insights are rendered server-side; we just add entrance animation
    const cards = $$(".insight-card", container);
    cards.forEach((card, i) => {
        card.style.opacity = "0";
        card.style.transform = "translateY(16px)";
        setTimeout(() => {
            card.style.transition = "opacity 0.4s ease, transform 0.4s ease";
            card.style.opacity = "1";
            card.style.transform = "translateY(0)";
        }, 100 + i * 80);
    });

    // Typing effect on insight text paragraphs (optional, subtle)
    $$(".insight-text", container).forEach((el, i) => {
        const original = el.textContent;
        if (original.length > 120) return; // skip long text
        el.textContent = "";
        let idx = 0;
        setTimeout(() => {
            const interval = setInterval(() => {
                el.textContent += original[idx++];
                if (idx >= original.length) clearInterval(interval);
            }, 18);
        }, 400 + i * 120);
    });
}


/* =============================================================
   10. GLOBAL UI POLISH
   ============================================================= */

/**
 * Add ripple effect to all .btn elements
 */
function initRippleEffect() {
    document.addEventListener("click", e => {
        const btn = e.target.closest(".btn");
        if (!btn) return;

        const ripple = document.createElement("span");
        const rect   = btn.getBoundingClientRect();
        const size   = Math.max(rect.width, rect.height);

        ripple.style.cssText = `
            position: absolute;
            width: ${size}px; height: ${size}px;
            border-radius: 50%;
            background: rgba(255,255,255,0.18);
            top:  ${e.clientY - rect.top  - size / 2}px;
            left: ${e.clientX - rect.left - size / 2}px;
            transform: scale(0);
            animation: rippleAnim 0.55s ease-out forwards;
            pointer-events: none;
        `;

        if (getComputedStyle(btn).position === "static") {
            btn.style.position = "relative";
        }
        btn.style.overflow = "hidden";
        btn.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
    });

    // Inject keyframe once
    if (!document.getElementById("ripple-style")) {
        const style = document.createElement("style");
        style.id = "ripple-style";
        style.textContent = `
            @keyframes rippleAnim {
                to { transform: scale(2.5); opacity: 0; }
            }
            @keyframes fadeInOverlay {
                from { opacity: 0; }
                to   { opacity: 1; }
            }
            @keyframes scaleIn {
                from { transform: scale(0.85); opacity: 0; }
                to   { transform: scale(1);    opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
}

/**
 * Scroll-triggered fade-in for elements with .fade-in-scroll class
 */
function initScrollAnimations() {
    const els = $$(".fade-in-scroll");
    if (!els.length) return;

    const observer = new IntersectionObserver(
        entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.12 }
    );

    els.forEach(el => observer.observe(el));
}

/**
 * Auto-dismiss Flask flash messages after 4 seconds
 */
function initFlashMessages() {
    $$(".alert-dismissible").forEach((alert, i) => {
        setTimeout(() => {
            alert.style.transition = "opacity 0.4s, transform 0.4s";
            alert.style.opacity = "0";
            alert.style.transform = "translateY(-8px)";
            setTimeout(() => alert.remove(), 400);
        }, 3000 + i * 500);
    });
}

/**
 * Smooth page transitions on internal link clicks
 */
function initPageTransitions() {
    document.addEventListener("click", e => {
        const link = e.target.closest("a[href]");
        if (!link) return;

        const href = link.getAttribute("href");
        if (!href || href.startsWith("#") || href.startsWith("http") ||
            href.startsWith("mailto") || link.target === "_blank") return;

        e.preventDefault();
        document.body.style.transition = "opacity 0.2s ease";
        document.body.style.opacity = "0";
        setTimeout(() => { window.location.href = href; }, 200);
    });
}

/**
 * Number input — prevent negative values and non-numeric input
 */
function initNumberInputGuards() {
    $$("input[type='number']").forEach(input => {
        input.addEventListener("keydown", e => {
            if (e.key === "-" || e.key === "e" || e.key === "E") {
                e.preventDefault();
            }
        });
        input.addEventListener("paste", e => {
            const paste = (e.clipboardData || window.clipboardData).getData("text");
            if (!/^\d*\.?\d*$/.test(paste)) e.preventDefault();
        });
    });
}


/* =============================================================
   11. BOOTSTRAP TOOLTIP & POPOVER INIT
   ============================================================= */

function initBootstrapComponents() {
    // Tooltips
    if (typeof bootstrap !== "undefined") {
        $$('[data-bs-toggle="tooltip"]').forEach(el => {
            new bootstrap.Tooltip(el, { trigger: "hover focus" });
        });
        // Popovers
        $$('[data-bs-toggle="popover"]').forEach(el => {
            new bootstrap.Popover(el);
        });
    }
}


/* =============================================================
   12. INIT — run everything on DOM ready
   ============================================================= */

document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initNavbar();
    initDashboard();
    initExpenseForm();
    initExpensesPage();
    initBudgetForm();
    initAIInsights();
    initRippleEffect();
    initScrollAnimations();
    initFlashMessages();
    initPageTransitions();
    initNumberInputGuards();
    initBootstrapComponents();

    // Restore body opacity if page was loaded via transition
    document.body.style.opacity = "1";
    document.body.style.transition = "opacity 0.25s ease";
});