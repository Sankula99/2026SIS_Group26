document.querySelectorAll(".session").forEach((row) => {
  row.addEventListener("click", (event) => {
    if (event.target.closest(".fomo-pill")) return;
    const radio = row.querySelector("input[type=radio]");
    if (radio) radio.checked = true;
    document.querySelectorAll(".session").forEach(el => el.classList.remove("highlighted"));
    row.classList.add("highlighted");
  });
});

document.querySelectorAll(".fomo-pill").forEach((pill) => {
  pill.title = "FOMO friend indicator";
  pill.addEventListener("click", () => {
    const name = pill.querySelector("small")?.textContent || "Friend details";
    alert(`FOMO friends in this session:\n${name}`);
  });
});
