const fs = require("fs");

const Enum = require("enum");
const csv = require("csv-parser");
const createCsvWriter = require("csv-writer").createArrayCsvWriter;
const childProcess = require("child_process");

/**
 * Enum for statistics grouping (year, month, day, null)
 * @readonly
 * @enum {string|null}
 */
const StatPeriod = new Enum(
    ["year", "month", "day", null],
    { ignoreCase: true },
    { freeze: true }
);

/**
 * Class to collect, filter and save vscode statistics to csv files
 * @property {string|null} [outDir] - path of the directory where
 *     the gathered data will be saved into csv files
 * @property {StatPeriod} [datePeriod=year] - grouping of the statistics
 * @property {boolean} [writeExtensionName=false] - flag used to write the name of the extension into a csv column
 * @property {boolean} [mergeStoredData=true] - flag used to merge actual day's vscode statistics with previously stored
 */
class WriteVscodeStat {
    #extensionName;
    outDir;

    #datePeriod;
    #writeExtensionName;
    #mergeStoredData;

    #statisticsTypes = {
        downloadCount: null,
        install: null,
        updateCount: null,
        averagerating: null,
        ratingcount: null,
        weightedRating: null,
        trendingdaily: null,
        trendingweekly: null,
        trendingmonthly: null,
    };

    /**
     * Initialize WriteVscodeStat class
     * @param {string} extensionName - name of the target vscode extension
     * @param {string|null} [outDir] - path of the directory where
     *     the gathered data will be saved into csv files
     */
    constructor(extensionName, outDir) {
        if (!extensionName) {
            throw new Error("extensionName is a required argument");
        }

        this.#extensionName = extensionName;
        this.outDir = outDir;

        this.#datePeriod = StatPeriod.year;
        this.#writeExtensionName = false;
        this.#mergeStoredData = true;
    }

    get extensionName() {
        return this.#extensionName;
    }

    get datePeriod() {
        return this.#datePeriod;
    }

    set datePeriod(datePeriod) {
        this.#datePeriod = StatPeriod.get(datePeriod);
    }

    get writeExtensionName() {
        return this.#writeExtensionName;
    }

    set writeExtensionName(writeExtensionName) {
        this.#writeExtensionName = Boolean(writeExtensionName);
    }

    get mergeStoredData() {
        return this.#mergeStoredData;
    }

    set mergeStoredData(mergeStoredData) {
        this.#mergeStoredData = Boolean(mergeStoredData);
    }

    /**
     * Returns actual day's vscode statistics for an extension
     * @returns {Promise} Promise object represents the actual day's vscode statistics for an extension
     */
    getVscodeStat() {
        return new Promise((resolve) => {
            return resolve(this.#getStat(100));
        });
    }

    #getStat(retryLimit, retryCount) {
        retryLimit = retryLimit || Number.MAX_VALUE;
        retryCount = Math.max(retryCount || 0, 0);
        const command = "npx vsce show vizzuhq.code-viz-stat --json";
        return new Promise((resolve, reject) => {
            childProcess.exec(
                command,
                (error, standardOutput, standardError) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    if (standardError) {
                        reject(standardError);
                        return;
                    }
                    standardOutput = JSON.parse(standardOutput);
                    const responseObject = {};
                    const dayObj = new Date();
                    const day =
                        dayObj.getFullYear() +
                        "-" +
                        ("0" + (dayObj.getMonth() + 1)).slice(-2) +
                        "-" +
                        ("0" + dayObj.getDate()).slice(-2);
                    const statKey = day;
                    const statValues = [];
                    statValues.push(day);
                    if (this.writeExtensionName) {
                        statValues.push(this.#extensionName);
                    }
                    standardOutput.statistics.forEach((stat) => {
                        this.#statisticsTypes[stat.statisticName] = stat.value;
                    });
                    for (const [key, value] of Object.entries(
                        this.#statisticsTypes
                    )) {
                        statValues.push(value);
                    }
                    responseObject[statKey] = statValues;
                    resolve(responseObject);
                }
            );
        });
    }

    /**
     * Writes actual day's vscode statistics for an extension
     * @param {string|null} [postfix=vscodestat] - postfix of the csv file
     * @returns {Promise} Promise object represents the actual day's vscode statistics for an extension
     */
    writeVscodeStat(postfix = "vscodestat") {
        return new Promise((resolve) => {
            const stats = this.getVscodeStat();
            stats.then((stats) => {
                const dayObj = new Date();
                const day =
                    dayObj.getFullYear() +
                    "-" +
                    ("0" + (dayObj.getMonth() + 1)).slice(-2) +
                    "-" +
                    ("0" + dayObj.getDate()).slice(-2);
                const grouped = this.#groupStats(stats, day, postfix);
                this.#mergeStats(grouped).then((merged) => {
                    this.#writeStats(merged);
                    return resolve(merged);
                });
            });
        });
    }

    #groupStats(stats, day, postfix) {
        const grouped = {};
        if (this.datePeriod) {
            let substring;
            if (this.datePeriod === StatPeriod.year) {
                substring = 4;
            } else if (this.datePeriod === StatPeriod.month) {
                substring = 7;
            } else if (this.datePeriod === StatPeriod.month) {
                substring = 10;
            }
            const initialized = {};
            const prefix = day.substring(0, substring);
            if (!initialized[prefix]) {
                initialized[prefix] = true;
                grouped[prefix + "_" + postfix + ".csv"] = [];
            }
            grouped[prefix + "_" + postfix + ".csv"].push([day, stats[day]]);
        } else {
            grouped[postfix + ".csv"] = [];
            grouped[postfix + ".csv"].push([day, stats[day]]);
        }
        return grouped;
    }

    #mergeStats(stats) {
        return new Promise((resolve) => {
            if (!this.mergeStoredData) {
                return resolve(stats);
            }
            const csvFiles = {};
            const csvFilesReady = [];
            for (const [key, value] of Object.entries(stats)) {
                const csvFileReady = this.#readCsv(key, value[0]);
                csvFilesReady.push(csvFileReady);
                csvFileReady.then((csvData) => {
                    Object.assign(csvFiles, csvData);
                });
            }
            Promise.all(csvFilesReady).then(() => {
                for (const [key] of Object.entries(stats)) {
                    if (csvFiles[key]) {
                        stats[key] = csvFiles[key].concat(stats[key]);
                    }
                }
                return resolve(stats);
            });
        });
    }

    #readCsv(csvFile, firstNewLine) {
        return new Promise((resolve) => {
            const csvData = {};
            csvData[csvFile] = [];
            if (!this.outDir) {
                return resolve(csvData);
            }
            const csvFilePath = this.outDir + "/" + csvFile;
            const writeExtensionName = this.writeExtensionName;
            const statisticsTypes = this.#statisticsTypes;
            fs.stat(csvFilePath, function (err) {
                if (err != null) {
                    return resolve(csvData);
                }
                fs.createReadStream(csvFilePath)
                    .pipe(csv())
                    .on("data", (row) => {
                        if (firstNewLine) {
                            if (row.date < firstNewLine[0].substring(0, 10)) {
                                const statKey = row.date;
                                const statValues = [];
                                statValues.push(row.date);
                                if (writeExtensionName) {
                                    statValues.push(row.extension);
                                }
                                for (const [key] of Object.entries(
                                    statisticsTypes
                                )) {
                                    statValues.push(row[key]);
                                }
                                csvData[csvFile].push([statKey, statValues]);
                            }
                        }
                    })
                    .on("end", () => {
                        return resolve(csvData);
                    });
            });
        });
    }

    #writeStats(stats) {
        if (this.outDir) {
            fs.mkdir(this.outDir, { recursive: true }, (err) => {
                if (err) {
                    throw err;
                }
                for (const [key, value] of Object.entries(stats)) {
                    const csvFilePath = this.outDir + "/" + key;
                    const header = ["date"];
                    if (this.writeExtensionName) {
                        header.push("extension");
                    }
                    for (const [key] of Object.entries(this.#statisticsTypes)) {
                        header.push(key);
                    }
                    const csvWriter = createCsvWriter({
                        path: csvFilePath,
                        header,
                    });
                    const postProcessedStats = [];
                    value.forEach((stat) => {
                        postProcessedStats.push(stat[1]);
                    });
                    csvWriter.writeRecords(postProcessedStats).catch((err) => {
                        throw err;
                    });
                }
            });
        }
    }
}

module.exports = WriteVscodeStat;
