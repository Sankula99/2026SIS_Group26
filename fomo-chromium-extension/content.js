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
    },

    // Dummy friend data used to test the different People overlay states.
    "41181_SPR_U_1_S": {

      // Activity 01: 1 normal friend
      // Expected: people-one icon
      "Ava": {
        "Cmp1": "01",
        "closeFriend": false
      },

      // Activity 02: 3 normal friends
      // Expected: people-two icon
      "Noah": {
        "Cmp1": "02",
        "closeFriend": false
      },
      "Mia": {
        "Cmp1": "02",
        "closeFriend": false
      },
      "Ethan": {
        "Cmp1": "02",
        "closeFriend": false
      },

      // Activity 03: 10 normal friends
      // Expected: people-many icon
      "Oliver": {
        "Cmp1": "03",
        "closeFriend": false
      },
      "Isla": {
        "Cmp1": "03",
        "closeFriend": false
      },
      "Jack": {
        "Cmp1": "03",
        "closeFriend": false
      },
      "Grace": {
        "Cmp1": "03",
        "closeFriend": false
      },
      "Charlie": {
        "Cmp1": "03",
        "closeFriend": false
      },
      "Amelia": {
        "Cmp1": "03",
        "closeFriend": false
      },
      "Henry": {
        "Cmp1": "03",
        "closeFriend": false
      },
      "Ella": {
        "Cmp1": "03",
        "closeFriend": false
      },
      "William": {
        "Cmp1": "03",
        "closeFriend": false
      },
      "Chloe": {
        "Cmp1": "03",
        "closeFriend": false
      },

      // Activity 04: 1 close friend and no normal friends
      // Expected: close-friend star only
      "Rose": {
        "Cmp1": "04",
        "closeFriend": true
      },

      // Activity 05: 1 close friend + 1 normal friend
      // Expected: close-friend star + people-one icon
      "Malakai": {
        "Cmp1": "05",
        "closeFriend": true
      },
      "Luna": {
        "Cmp1": "05",
        "closeFriend": false
      },

      // Activity 06: 1 close friend + 3 normal friends
      // Expected: close-friend star + people-two icon
      "Sofia": {
        "Cmp1": "06",
        "closeFriend": true
      },
      "Leo": {
        "Cmp1": "06",
        "closeFriend": false
      },
      "Aria": {
        "Cmp1": "06",
        "closeFriend": false
      },
      "Finn": {
        "Cmp1": "06",
        "closeFriend": false
      },

      // Activity 07: 2 close friends + 1 normal friend
      // Expected: close-friend star + people-one icon
      "Emily": {
        "Cmp1": "07",
        "closeFriend": true
      },
      "James": {
        "Cmp1": "07",
        "closeFriend": true
      },
      "Harper": {
        "Cmp1": "07",
        "closeFriend": false
      },

      // Activity 08: 2 close friends + 10 normal friends
      // Expected: close-friend star + people-many icon
      "Liam": {
        "Cmp1": "08",
        "closeFriend": true
      },
      "Charlotte": {
        "Cmp1": "08",
        "closeFriend": true
      },
      "Lucas": {
        "Cmp1": "08",
        "closeFriend": false
      },
      "Evie": {
        "Cmp1": "08",
        "closeFriend": false
      },
      "Daniel": {
        "Cmp1": "08",
        "closeFriend": false
      },
      "Ruby": {
        "Cmp1": "08",
        "closeFriend": false
      },
      "Thomas": {
        "Cmp1": "08",
        "closeFriend": false
      },
      "Isabelle": {
        "Cmp1": "08",
        "closeFriend": false
      },
      "Oscar": {
        "Cmp1": "08",
        "closeFriend": false
      },
      "Sophia": {
        "Cmp1": "08",
        "closeFriend": false
      },
      "Max": {
        "Cmp1": "08",
        "closeFriend": false
      },
      "Lucy": {
        "Cmp1": "08",
        "closeFriend": false
      }
    }
    
  };

  const PEOPLE_HEADER_TEXT = "People";
  const PEOPLE_HEADER_CLASS = "mytimetable-people-header";
  const PEOPLE_CELL_CLASS = "mytimetable-people-cell";

  // Styles for the FOMO People overlay icons.
  const FOMO_STYLE = document.createElement("style");

  FOMO_STYLE.textContent = `
    .mytimetable-people-icon {
      width: 24px;
      height: 24px;
      object-fit: contain;
      vertical-align: middle;
    }

    .mytimetable-people-one-icon {
      width: 20px;
      height: 18px;
      object-fit: contain;
      vertical-align: middle;
    }

    .mytimetable-people-many-icon {
      width: 36px;
      height: 24px;
      object-fit: contain;
      vertical-align: middle;
    }

    .mytimetable-close-friend-icon {
      width: 18px;
      height: 18px;
      object-fit: contain;
      vertical-align: middle;
    }
  `;

  document.head.appendChild(FOMO_STYLE);

  let updateScheduled = false;

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

  // Gets the subject, activity group, and activity ID from the Activity Details page.
  function getActivityDetailsInfo() {
    const activityDetails = document.querySelector("#activity-details-tpl");

    if (!activityDetails) {
      return null;
    }

    const lowerSection = activityDetails.querySelector(".lower_sec");

    if (!lowerSection) {
      return null;
    }

    // The first two divs contain the subject code and subject name.
    const subjectCode = lowerSection.querySelector("div:nth-child(1) b");
    
    if (!subjectCode) {
      return null;
    }

    const timetableKey = subjectCode.textContent.trim();

    // Read the activity details from the table.
    const rows = lowerSection.querySelectorAll("table.aplus-table tbody tr");

    let activityGroup = "";
    let activityId = "";

    rows.forEach((row) => {
      const cells = row.querySelectorAll("td");

      if (cells.length < 2) {
        return;
      }

      const label = cells[0].textContent.trim();
      const value = cells[1].textContent.trim();

      if (label === "Group") {
        activityGroup = value;
      }

      if (label === "Activity") {
        activityId = value;
      }
    });

    if (!timetableKey || !activityGroup || !activityId) {
      return null;
    }

    return {
      timetableKey,
      activityGroup,
      activityId
    };
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

  // Gets information about friends who are enrolled in a specific activity.
  // Close friends and normal friends are counted separately.
  function getPeopleInfo(timetableKey, activityGroup, activityId) {
    const subjectPeople = PEOPLE[timetableKey];

    if (!subjectPeople || !activityGroup) {
      return {
        totalFriends: 0,
        closeFriends: [],
        friends: []
      };
    }
    // Find all friends who are enrolled in this specific activity.
    const matchingPeople = Object.entries(subjectPeople)
      .filter(([, activities]) =>
        activities?.[activityGroup] === activityId
      );

    // Identify close friends separately from normal friends.
    const closeFriends = matchingPeople
      .filter(([, activities]) => activities?.closeFriend === true)
      .map(([person]) => person);

    const friends = matchingPeople
      .filter(([, activities]) => activities?.closeFriend !== true)
      .map(([person]) => person);

    return {
      totalFriends: friends.length,
      closeFriends,
      friends
    };
  }

  // Creates hover tooltip text showing the number of close and normal friends
  function getPeopleTooltip(peopleInfo) {
    const closeFriendCount = peopleInfo.closeFriends.length;
    const friendCount = peopleInfo.totalFriends;

    // Use singular or plural wording depending on the number of friends.
    const closeFriendText =
      closeFriendCount === 1
        ? "1 close friend"
        : `${closeFriendCount} close friends`;

    const friendText =
      friendCount === 1
        ? "1 friend"
        : `${friendCount} friends`;

    // Show both counts when the activity contains close and normal friends.
    if (closeFriendCount > 0 && friendCount > 0) {
      return `You have ${closeFriendText} and ${friendText} in this activity.`;
    }

    // Show only the close-friend count when there are no normal friends.
    if (closeFriendCount > 0) {
      return `You have ${closeFriendText} in this activity.`;
    }

    // Show only the normal-friend count when there are no close friends.
    if (friendCount > 0) {
      return `You have ${friendText} in this activity.`;
    }

    return "You have no friends in this activity.";
  }

  // Selects the People icon based on the number of normal friends in an activity.
  // No icon is shown when there are no normal friends.
  function getPeopleIcon(totalFriends) {
    if (totalFriends === 0) {
      return "";
    }

    if (totalFriends === 1) {
      return "icons/people-one.svg";
    }

    if (totalFriends < 10) {
      return "icons/people-two.svg";
    }

    return "icons/people-many.svg";
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

      // Get information about the friends in this activity.
      const peopleInfo = getPeopleInfo(
        timetableKey,
        activityGroup,
        activityId
      );

      // Add a tooltip showing the number of close and normal friends.
      peopleCell.title = getPeopleTooltip(peopleInfo);

      // Choose the appropriate FOMO icon based on the number of friends.
      const iconPath = getPeopleIcon(peopleInfo.totalFriends);

      // Show a star if there is at least one close friend.
      const hasCloseFriend = peopleInfo.closeFriends.length > 0;
      
      // Only update the DOM when the icon actually changes.
      const peopleDisplayKey = `${iconPath}|${hasCloseFriend}`;
      
      if (peopleCell.dataset.peopleDisplayKey !== peopleDisplayKey) {
        peopleCell.innerHTML = "";

        // Add the close-friend star first.
        if (hasCloseFriend) {
          const closeFriendIcon = document.createElement("img");

          closeFriendIcon.src = chrome.runtime.getURL("icons/close-friend.svg");
          closeFriendIcon.alt = "Close friend";
          closeFriendIcon.className = "mytimetable-close-friend-icon";

          peopleCell.appendChild(closeFriendIcon);
        }
        
        // Add the People icon for normal friends.
        if (iconPath) {
          const icon = document.createElement("img");

          icon.src = chrome.runtime.getURL(iconPath);
          icon.alt = `${peopleInfo.totalFriends} friends`;
          
          // Applying different styling depending on the type of People icon.
          if (iconPath === "icons/people-many.svg") {
            icon.className = "mytimetable-people-many-icon";
          } 
          
          else if (iconPath === "icons/people-one.svg") {
            icon.className = "mytimetable-people-one-icon";
          } 
          
          else {
            icon.className = "mytimetable-people-icon";
          }

          peopleCell.appendChild(icon);
        }

        // peopleCell.dataset.peopleIcon = iconPath;
        peopleCell.dataset.peopleDisplayKey = peopleDisplayKey;
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

})();
