const fs = require("fs");

function time12ToSeconds(timeStr) {
    let [time, period] = timeStr.split(" ");
    let [hours, minutes, seconds] = time.split(":").map(Number);

    if (period.toLowerCase() === "pm" && hours !== 12) {
        hours += 12;
    }
    if (period.toLowerCase() === "am" && hours === 12) {
        hours = 0;
    }

    return hours * 3600 + minutes * 60 + seconds;
}


function secondsToHMS(totalSeconds) {
    let hours = Math.floor(totalSeconds / 3600);
    let remaining = totalSeconds % 3600;
    let minutes = Math.floor(remaining / 60);
    let seconds = remaining % 60;

    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function hmsToSeconds(timeStr) {
    let [hours, minutes, seconds] = timeStr.split(":").map(Number);
    return hours * 3600 + minutes * 60 + seconds;
}



// ============================================================
// Function 1: getShiftDuration(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getShiftDuration(startTime, endTime) {
    let startSeconds = time12ToSeconds(startTime);
    let endSeconds = time12ToSeconds(endTime);

    // Handle overnight shift
    if (endSeconds < startSeconds) {
        endSeconds += 24 * 3600;
    }

    let duration = endSeconds - startSeconds;

    return secondsToHMS(duration);
}

// ============================================================
// Function 2: getIdleTime(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getIdleTime(startTime, endTime) {
    let startSeconds = time12ToSeconds(startTime);
    let endSeconds = time12ToSeconds(endTime);

    if (endSeconds < startSeconds) {
        endSeconds += 24 * 3600;
    }

    let deliveryStart = 8 * 3600;
    let deliveryEnd = 22 * 3600;

    let idleSeconds = 0;

    if (startSeconds < deliveryStart) {
        idleSeconds += Math.min(endSeconds, deliveryStart) - startSeconds;
    }

    if (endSeconds > deliveryEnd) {
        idleSeconds += endSeconds - Math.max(startSeconds, deliveryEnd);
    }

    return secondsToHMS(idleSeconds);
}

// ============================================================
// Function 3: getActiveTime(shiftDuration, idleTime)
// shiftDuration: (typeof string) formatted as h:mm:ss
// idleTime: (typeof string) formatted as h:mm:ss
// Returns: string formatted as h:mm:ss
// ============================================================
function getActiveTime(shiftDuration, idleTime) {
    let shiftSeconds = hmsToSeconds(shiftDuration);
    let idleSeconds = hmsToSeconds(idleTime);

    let activeSeconds = shiftSeconds - idleSeconds;

    return secondsToHMS(activeSeconds);
}

// ============================================================
// Function 4: metQuota(date, activeTime)
// date: (typeof string) formatted as yyyy-mm-dd
// activeTime: (typeof string) formatted as h:mm:ss
// Returns: boolean
// ============================================================
function metQuota(date, activeTime) {

    let [year, month, day] = date.split("-").map(Number);

    let activeSeconds = hmsToSeconds(activeTime);

    let quotaSeconds;

    
    if (year === 2025 && month === 4 && day >= 10 && day <= 30) {
        quotaSeconds = 6 * 3600;
    } 
    else {
        quotaSeconds = (8 * 3600) + (24 * 60);
    }

    return activeSeconds >= quotaSeconds;
}
// ============================================================
// Function 5: addShiftRecord(textFile, shiftObj)
// textFile: (typeof string) path to shifts text file
// shiftObj: (typeof object) has driverID, driverName, date, startTime, endTime
// Returns: object with 10 properties or empty object {}
// ============================================================
function addShiftRecord(textFile, shiftObj) {
    let data = fs.readFileSync(textFile, "utf8");
    let lines = data.trim().split("\n");

    let header = lines[0];
    let records = lines.slice(1);

    for (let i = 0; i < records.length; i++) {
        let parts = records[i].split(",");

        if (parts[0] === shiftObj.driverID && parts[2] === shiftObj.date) {
            return {};
        }
    }

    let shiftDuration = getShiftDuration(shiftObj.startTime, shiftObj.endTime);
    let idleTime = getIdleTime(shiftObj.startTime, shiftObj.endTime);
    let activeTime = getActiveTime(shiftDuration, idleTime);
    let quota = metQuota(shiftObj.date, activeTime);

    let newObj = {
        driverID: shiftObj.driverID,
        driverName: shiftObj.driverName,
        date: shiftObj.date,
        startTime: shiftObj.startTime,
        endTime: shiftObj.endTime,
        shiftDuration: shiftDuration,
        idleTime: idleTime,
        activeTime: activeTime,
        metQuota: quota,
        hasBonus: false
    };

    let newLine =
        newObj.driverID + "," +
        newObj.driverName + "," +
        newObj.date + "," +
        newObj.startTime + "," +
        newObj.endTime + "," +
        newObj.shiftDuration + "," +
        newObj.idleTime + "," +
        newObj.activeTime + "," +
        newObj.metQuota + "," +
        newObj.hasBonus;

    let insertIndex = -1;

    for (let i = 0; i < records.length; i++) {
        let parts = records[i].split(",");
        if (parts[0] === shiftObj.driverID) {
            insertIndex = i;
        }
    }

    if (insertIndex === -1) {
        records.push(newLine);
    } else {
        records.splice(insertIndex + 1, 0, newLine);
    }

    let finalText = header + "\n" + records.join("\n");
    fs.writeFileSync(textFile, finalText);

    return newObj;
}
// ============================================================
// Function 6: setBonus(textFile, driverID, date, newValue)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// date: (typeof string) formatted as yyyy-mm-dd
// newValue: (typeof boolean)
// Returns: nothing (void)
// ============================================================
function setBonus(textFile, driverID, date, newValue) {
    let data = fs.readFileSync(textFile, "utf8");
    let lines = data.trim().split("\n");

    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === "") {
            continue;
        }

        let parts = lines[i].split(",");

        if (parts[0] === driverID && parts[2] === date) {
            parts[9] = String(newValue);
            lines[i] = parts.join(",");
            break;
        }
    }

    fs.writeFileSync(textFile, lines.join("\n"));
}
// ============================================================
// Function 7: countBonusPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof string) formatted as mm or m
// Returns: number (-1 if driverID not found)
// ============================================================
function countBonusPerMonth(textFile, driverID, month) {
    let data = fs.readFileSync(textFile, "utf8");
    let lines = data.trim().split("\n");

    let count = 0;
    let foundDriver = false;
    let targetMonth = String(Number(month));

    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === "") {
            continue;
        }

        let parts = lines[i].split(",");
        let id = parts[0];
        let date = parts[2];
        let hasBonus = parts[9];

        if (id === driverID) {
            foundDriver = true;

            let recordMonth = String(Number(date.split("-")[1]));

            if (recordMonth === targetMonth && hasBonus === "true") {
                count++;
            }
        }
    }

    if (!foundDriver) {
        return -1;
    }

    return count;
}
// ============================================================
// Function 8: getTotalActiveHoursPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getTotalActiveHoursPerMonth(textFile, driverID, month) {
    let data = fs.readFileSync(textFile, "utf8");
    let lines = data.trim().split("\n");

    let totalSeconds = 0;
    let targetMonth = String(Number(month));

    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === "") {
            continue;
        }

        let parts = lines[i].split(",");
        let id = parts[0];
        let date = parts[2];
        let activeTime = parts[7];

        let recordMonth = String(Number(date.split("-")[1]));

        if (id === driverID && recordMonth === targetMonth) {
            totalSeconds += hmsToSeconds(activeTime);
        }
    }

    return secondsToHMS(totalSeconds);
}

// ============================================================
// Function 9: getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month)
// textFile: (typeof string) path to shifts text file
// rateFile: (typeof string) path to driver rates text file
// bonusCount: (typeof number) total bonuses for given driver per month
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {
    let rateData = fs.readFileSync(rateFile, "utf8");
    let rateLines = rateData.trim().split("\n");

    let dayOff = "";

    for (let i = 0; i < rateLines.length; i++) {
        let parts = rateLines[i].split(",");
        if (parts[0] === driverID) {
            dayOff = parts[1];
            break;
        }
    }

    let data = fs.readFileSync(textFile, "utf8");
    let lines = data.trim().split("\n");

    let totalSeconds = 0;
    let targetMonth = String(Number(month));

    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === "") {
            continue;
        }

        let parts = lines[i].split(",");
        let id = parts[0];
        let date = parts[2];

        if (id !== driverID) {
            continue;
        }

        let [year, m, day] = date.split("-").map(Number);
        let recordMonth = String(m);

        if (recordMonth !== targetMonth) {
            continue;
        }

       
        let days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        let recordDay = days[new Date(year, m - 1, day).getDay()];

        if (recordDay === dayOff) {
            continue;
        }

        
        if (year === 2025 && m === 4 && day >= 10 && day <= 30) {
            totalSeconds += 6 * 3600;
        } else {
            totalSeconds += 8 * 3600 + 24 * 60;
        }
    }

    
    totalSeconds -= bonusCount * 2 * 3600;

    if (totalSeconds < 0) {
        totalSeconds = 0;
    }

    return secondsToHMS(totalSeconds);
}

// ============================================================
// Function 10: getNetPay(driverID, actualHours, requiredHours, rateFile)
// driverID: (typeof string)
// actualHours: (typeof string) formatted as hhh:mm:ss
// requiredHours: (typeof string) formatted as hhh:mm:ss
// rateFile: (typeof string) path to driver rates text file
// Returns: integer (net pay)
// ============================================================
function getNetPay(driverID, actualHours, requiredHours, rateFile) {
    let data = fs.readFileSync(rateFile, "utf8");
    let lines = data.trim().split("\n");

    let basePay = 0;
    let tier = 0;

    for (let i = 0; i < lines.length; i++) {
        let parts = lines[i].split(",");
        if (parts[0] === driverID) {
            basePay = Number(parts[2]);
            tier = Number(parts[3]);
            break;
        }
    }

    let actualSeconds = hmsToSeconds(actualHours);
    let requiredSeconds = hmsToSeconds(requiredHours);

    if (actualSeconds >= requiredSeconds) {
        return basePay;
    }

    let missingSeconds = requiredSeconds - actualSeconds;

    let allowedHours = 0;

    if (tier === 1) {
        allowedHours = 50;
    } else if (tier === 2) {
        allowedHours = 20;
    } else if (tier === 3) {
        allowedHours = 10;
    } else if (tier === 4) {
        allowedHours = 3;
    }

    let allowedSeconds = allowedHours * 3600;
    let billableSeconds = missingSeconds - allowedSeconds;

    if (billableSeconds < 0) {
        billableSeconds = 0;
    }

    let billableHours = Math.floor(billableSeconds / 3600);
    let deductionRatePerHour = Math.floor(basePay / 185);
    let salaryDeduction = billableHours * deductionRatePerHour;

    return basePay - salaryDeduction;
}
//funcs done
module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord,
    setBonus,
    countBonusPerMonth,
    getTotalActiveHoursPerMonth,
    getRequiredHoursPerMonth,
    getNetPay
};

//ready to submit
