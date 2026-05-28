// ==========================
// DARK / LIGHT MODE
// ==========================

// BUTTON

const themeToggle = document.getElementById("themeToggle");

// CHECK SAVED THEME

let currentTheme = localStorage.getItem("theme");

// APPLY SAVED THEME

if(currentTheme === "light"){

    document.body.classList.add("light-mode");

}

// BUTTON CLICK

themeToggle.addEventListener("click", () => {

    // TOGGLE CLASS

    document.body.classList.toggle("light-mode");

    // SAVE THEME

    if(document.body.classList.contains("light-mode")){

        localStorage.setItem("theme", "light");

    }

    else{

        localStorage.setItem("theme", "dark");

    }

});