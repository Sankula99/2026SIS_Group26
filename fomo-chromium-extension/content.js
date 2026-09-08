(() => {
  "use strict";

  /*
   * Structure:
   *
   *   "<subject/timetable key>": {
   *     "<person>": {
   *       "<activity group>": "<activity number>"
   *     }
   *   }
   * 
   * A person can therefore have one saved activity number for every
   * activity group in the subject, e.g. Lec1, Tut1, Lab1, etc.
   */
  const PEOPLE = {
    "31005_SPR_U_1_S": {
      "Fred": {
        "Lec1": "01",
        "Tut1": "03",
        "Lab1": "02"
      },
      "Alice": {
        "Lec1": "02",
        "Tut1": "03",
        "Lab1": "01"
      },
      "Bob": {
        "Lec1": "02",
        "Tut1": "01",
        "Lab1": "02"
      }
    },

    "41129_SPR_U_1_S": {
      "Jane": {
        "Wrk1": "01"
      },
      "Sam": {
        "Wrk1": "01"
      }
    }
  };

  const PEOPLE_HEADER_TEXT = "People";
  const PEOPLE_HEADER_CLASS = "mytimetable-people-header";
  const PEOPLE_CELL_CLASS = "mytimetable-people-cell";

  let updateScheduled = false;

  function startCalendarObserver() {
    let lastCheckedUrl = null;
    let checking = false;
    let checkScheduled = false;

    function findCalendarUrl() {
      // This is the lazy method where we just look at all text fields until we find something
      // that looks like the right URL, instead of knowing the exact structure.
      for (const input of document.querySelectorAll('input[type="text"]')) {
        try {
          const url = new URL(input.value.trim());
          if (url.origin === "https://mytimetablecloud.uts.edu.au" &&
              /^\/even\/rest\/calendar\/ical\/[^/]+$/.test(url.pathname) &&
              !url.username && !url.password) {
            return url.href;
          }
        } catch {
          // Most text inputs are not URLs.
          // From testing there should only be two anyway so this isn't a big search
        }
      }
      return null;
    }

    async function checkCalendar() {
      if (checking) return;
      const url = findCalendarUrl();
      if (!url || url === lastCheckedUrl) return;
      checking = true;
      lastCheckedUrl = url;
      try {
        const user = await FomoCalendar.importCalendar(url);
        if (user) console.info("[FOMO] Current user timetable:\n" + JSON.stringify(user, null, 2));
      } catch {
        // Do not include fetch errors, which can expose the private calendar URL.
        console.warn("[FOMO] Calendar import failed. Reload the timetable page to retry.");
      } finally {
        checking = false;
        // The user may have switched calendars while this request was running.
        scheduleCalendarCheck();
      }
    }

    function scheduleCalendarCheck() {
      if (checkScheduled) return; //debounce
      checkScheduled = true;
      queueMicrotask(() => {
        checkScheduled = false;
        void checkCalendar();
      });
    }

    const observer = new MutationObserver(scheduleCalendarCheck);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["value"]
    });
    document.addEventListener("input", scheduleCalendarCheck);
    document.addEventListener("change", scheduleCalendarCheck);
    // Assigning input.value directly does not trigger a MutationObserver.
    window.setInterval(scheduleCalendarCheck, 2000);
    scheduleCalendarCheck();
  }

  /**
   * Read the timetable key directly from the <h3> inside .desc-text.
   */
  function getTimetableKey(groupRoot) {
    const heading = groupRoot.querySelector(".desc-text h3");
    if (!heading) {
      return null;
    }

    return heading.textContent.trim();
  }

  /**
   * Get the current activity group, e.g. "Lec1".
   *
   * The supplied HTML exposes this directly as:
   *   <a id="sa_list_ro" ... data-group="Lec1">
   */
  function getActivityGroup(groupRoot) {
    const groupElement = groupRoot.querySelector(
      "#sa_list_ro[data-group], #sa_grid_ro[data-group], [data-group]"
    );

    if (groupElement?.dataset.group) {
      return groupElement.dataset.group.trim();
    }

    // Fallback - formatted as subject|activityGroup|activityNumber
    const firstRowWithId = groupRoot.querySelector(
      "table.aplus-table tbody > tr[id]"
    );

    if (firstRowWithId?.id) {
      const parts = firstRowWithId.id.split("|");
      if (parts.length >= 3 && parts[1].trim()) {
        return parts[1].trim();
      }
    }

    // Final fallback - the activity group is the last non-empty line in .desc-text
    const description = groupRoot.querySelector(".desc-text");
    if (description) {
      const lines = description.innerText
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

      if (lines.length >= 2) {
        return lines[lines.length - 1];
      }
    }

    return null;
  }

  /**
   * Get the Activity ID for a table row.
   *
   * The first <td> is the allocation/status icon,
   * and the second <td> contains the Activity value such as "01".
   *
   * If that is unavailable, fall back to the "00001_SPR_U_1_S|Lec1|01" thing
   */
  function getActivityId(row) {
    const cells = row.querySelectorAll(":scope > td");

    if (cells.length >= 2) {
      const activity = cells[1].textContent.trim();
      if (activity) {
        return activity;
      }
    }

    if (row.id) {
      const parts = row.id.split("|");
      if (parts.length >= 3) {
        return parts[parts.length - 1].trim();
      }
    }

    return null;
  }

  function formatPeople(timetableKey, activityGroup, activityId) {
    const subjectPeople = PEOPLE[timetableKey];

    if (!subjectPeople || !activityGroup) {
      return "";
    }

    const matchingPeople = Object.entries(subjectPeople)
      .filter(([, activities]) =>
        activities?.[activityGroup] === activityId
      )
      .map(([person]) => person);

    return matchingPeople.join(", ");
  }

  function addPeopleColumnToTable(groupRoot, table) {
    const timetableKey = getTimetableKey(groupRoot);
    const activityGroup = getActivityGroup(groupRoot);

    if (!timetableKey || !activityGroup) {
      return;
    }

    const headerRow = table.querySelector("thead tr");
    if (!headerRow) {
      return;
    }

    // Add the header only once for this particular table.
    let peopleHeader = headerRow.querySelector(
      `th.${PEOPLE_HEADER_CLASS}`
    );

    if (!peopleHeader) {
      peopleHeader = document.createElement("th");
      peopleHeader.className = PEOPLE_HEADER_CLASS;
      peopleHeader.textContent = PEOPLE_HEADER_TEXT;

      // The Description column is the last <th>, so appending puts 'People' directly after it.
      headerRow.appendChild(peopleHeader);
    }

    const rows = table.querySelectorAll("tbody > tr");

    for (const row of rows) {
      const activityId = getActivityId(row);
      if (!activityId) {
        continue;
      }

      let peopleCell = row.querySelector(
        `:scope > td.${PEOPLE_CELL_CLASS}`
      );

      if (!peopleCell) {
        peopleCell = document.createElement("td");
        peopleCell.className = PEOPLE_CELL_CLASS;
        row.appendChild(peopleCell);
      }

      // Only write to the DOM when the value actually changed.
      //
      // This is important because #group-tpl is watched by a MutationObserver. Reassigning textContent on every observer pass would itself create another mutation, causing an update loop.
      const peopleText = formatPeople(
        timetableKey,
        activityGroup,
        activityId
      );

      if (peopleCell.textContent !== peopleText) {
        peopleCell.textContent = peopleText;
      }
    }
  }

  function updatePeopleColumns() {
    /*
     * There should only be one #group-tpl-RO - but querying by the structural relationship makes this work if there's
     * more than one in the future for some reason.
     */
    const groupRoots = document.querySelectorAll(
      "#group-tpl > #group-tpl-RO"
    );

    for (const groupRoot of groupRoots) {
      const tables = groupRoot.querySelectorAll(
        ".aplus-table-container table.aplus-table"
      );

      for (const table of tables) {
        addPeopleColumnToTable(groupRoot, table);
      }
    }
  }

  /**
   * Collapse many rapid DOM mutations into a single update pass.
   */
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

  function startObserver() {
    const groupTemplate = document.querySelector("#group-tpl");

    if (groupTemplate) {
      /*
       * This handles
       * - #group-tpl-RO being created
       * - the timetable being rebuilt
       * - table rows being replaced/added
       * - text being updated inside the module
       */
      const observer = new MutationObserver(scheduleUpdate);

      observer.observe(groupTemplate, {
        childList: true,
        subtree: true,
        characterData: true
      });

      // Handle a table that already exists when the content script loads.
      updatePeopleColumns();
      return;
    }

    /*
     * If #group-tpl itself has not been inserted yet, briefly observe the
     * document until it appears, then attach the more targeted observer.
     */
    const bootstrapObserver = new MutationObserver(() => {
      if (document.querySelector("#group-tpl")) {
        bootstrapObserver.disconnect();
        startObserver();
      }
    });

    bootstrapObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  startObserver();
  startCalendarObserver();
})();
