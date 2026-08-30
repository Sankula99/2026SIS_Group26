(() => {
  "use strict";

  /*
   * People keyed by the timetable heading and activity ID.
   * This is prototype data until friend information comes from a backend.
   */
  const PEOPLE_BY_ACTIVITY = {
    "31005_SPR_U_1_S": {
      "01": ["Fred"],
      "02": ["Alice", "Bob"],
      "03": ["Charlie"],
    },
    "41030_SPR_U_1_S": {
      "01": ["Jane", "Sam"],
    },
  };

  const PEOPLE_HEADER_TEXT = "People";
  const PEOPLE_HEADER_CLASS = "mytimetable-people-header";
  const PEOPLE_CELL_CLASS = "mytimetable-people-cell";

  let updateScheduled = false;

  function getTimetableKey(groupRoot) {
    return groupRoot.querySelector(".desc-text h3")?.textContent.trim() || null;
  }

  function getActivityId(row) {
    const activity = row.querySelector(":scope > td:nth-child(2)")?.textContent.trim();
    if (activity) {
      return activity;
    }

    const idParts = row.id?.split("|");
    return idParts?.length >= 3 ? idParts.at(-1).trim() : null;
  }

  function getPeopleText(timetableKey, activityId) {
    return (PEOPLE_BY_ACTIVITY[timetableKey]?.[activityId] ?? []).join(", ");
  }

  function updateTable(groupRoot, table) {
    const timetableKey = getTimetableKey(groupRoot);
    const headerRow = table.querySelector("thead tr");
    if (!timetableKey || !headerRow) {
      return;
    }

    if (!headerRow.querySelector(`th.${PEOPLE_HEADER_CLASS}`)) {
      const header = document.createElement("th");
      header.className = PEOPLE_HEADER_CLASS;
      header.textContent = PEOPLE_HEADER_TEXT;
      headerRow.appendChild(header);
    }

    for (const row of table.querySelectorAll("tbody > tr")) {
      const activityId = getActivityId(row);
      if (!activityId) {
        continue;
      }

      let cell = row.querySelector(`:scope > td.${PEOPLE_CELL_CLASS}`);
      if (!cell) {
        cell = document.createElement("td");
        cell.className = PEOPLE_CELL_CLASS;
        row.appendChild(cell);
      }

      const peopleText = getPeopleText(timetableKey, activityId);
      if (cell.textContent !== peopleText) {
        cell.textContent = peopleText;
      }
    }
  }

  function updatePeopleColumns() {
    const groupRoots = document.querySelectorAll("#group-tpl > #group-tpl-RO");

    for (const groupRoot of groupRoots) {
      for (const table of groupRoot.querySelectorAll(".aplus-table-container table.aplus-table")) {
        updateTable(groupRoot, table);
      }
    }
  }

  function scheduleUpdate() {
    if (updateScheduled) {
      return;
    }

    updateScheduled = true;
    queueMicrotask(() => {
      updateScheduled = false;
      updatePeopleColumns();
    });
  }

  function observeTimetable() {
    const groupTemplate = document.querySelector("#group-tpl");

    if (!groupTemplate) {
      const bootstrapObserver = new MutationObserver(() => {
        if (document.querySelector("#group-tpl")) {
          bootstrapObserver.disconnect();
          observeTimetable();
        }
      });

      bootstrapObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
      return;
    }

    new MutationObserver(scheduleUpdate).observe(groupTemplate, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    updatePeopleColumns();
  }

  observeTimetable();
})();
