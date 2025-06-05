/**
 * スプレッドシートのID (現在のスクリプトが紐づいているシートを自動的に使う)
 */
const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
/**
 * 日記データが保存されているシート名
 */
const SHEET_NAME = 'DiaryData';
/**
 * インデックスデータが保存されているシート名
 */
const INDEX_SHEET_NAME = 'Index';

// --- (doGet, rebuildIndex, loadDiary, updateIndex は変更なし) ---

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('MyDayKeeper')
      .setTitle('MyDayKeeper')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

function rebuildIndex() {
  try {
    Logger.log('【最終版】rebuildIndex を開始します。');
    const diarySheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!diarySheet) { throw new Error('シート "' + SHEET_NAME + '" が見つかりません。'); }

    let indexSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(INDEX_SHEET_NAME);
    if (indexSheet) {
      indexSheet.clear();
    } else {
      indexSheet = SpreadsheetApp.openById(SPREADSHEET_ID).insertSheet(INDEX_SHEET_NAME);
    }
    indexSheet.getRange('A1:B1').setValues([['MonthDayKey', 'RowNumbers']]);

    const lastRow = diarySheet.getLastRow();
    if (lastRow <= 1) {
      Logger.log('日記データがありません。処理を終了します。');
      return;
    }

    const data = diarySheet.getRange(2, 1, lastRow - 1, 4).getValues();
    Logger.log('DiaryDataシートから ' + data.length + ' 件のデータを読み込みました。');
    const indexData = {}; 

    for (let i = 0; i < data.length; i++) {
      const rowNum = i + 2;
      const dateObj = data[i][0];
      if (dateObj instanceof Date && !isNaN(dateObj)) {
        const month = dateObj.getMonth() + 1;
        const day = dateObj.getDate();
        const key = `${month}-${day}`;
        if (!indexData[key]) {
          indexData[key] = [];
        }
        indexData[key].push(rowNum);
      } else {
         Logger.log(`行番号 ${rowNum} はA列が有効な日付ではないためスキップします。値: ${dateObj}`);
         continue; 
      }
    }

    const outputData = Object.keys(indexData).map(function(key) {
      // ▼▼▼ ここを修正 ▼▼▼
      // キーの先頭にシングルクォートを追加して、強制的に文字列として書き込む
      return ["'" + key, JSON.stringify(indexData[key].sort(function(a, b) { return a - b; }))];
      // ▲▲▲ ここを修正 ▲▲▲
    });

    if (outputData.length > 0) {
      outputData.sort((a, b) => {
          const [aMonth, aDay] = a[0].substring(1).split('-').map(Number); // substring(1)で ' を除外
          const [bMonth, bDay] = b[0].substring(1).split('-').map(Number); // substring(1)で ' を除外
          if(aMonth !== bMonth) return aMonth - bMonth;
          return aDay - bDay;
      });
      indexSheet.getRange(2, 1, outputData.length, 2).setValues(outputData);
    }

    Logger.log('【最終版完了】インデックスの再構築が完了しました。' + outputData.length + '個のキーが作成されました。');

  } catch (error) {
    Logger.log('【エラー】rebuildIndexの実行中にエラーが発生しました: ' + error.message + '\n' + error.stack);
    throw error;
  }
}

function loadDiary(payload) {
  try {
    const targetMonth = payload.month;
    const targetDay = payload.day;
    const key = `${targetMonth}-${targetDay}`;

    const indexSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(INDEX_SHEET_NAME);
    if (!indexSheet) {
      throw new Error(`インデックスシート "${INDEX_SHEET_NAME}" が見つかりません。「rebuildIndex」を一度実行してください。`);
    }

    const keyColumnValues = indexSheet.getRange(2, 1, indexSheet.getLastRow() - 1, 1).getValues();
    let rowNumbers = [];
    for (let i = 0; i < keyColumnValues.length; i++) {
      if (String(keyColumnValues[i][0]) == String(key)) {
        const rowNumbersJson = indexSheet.getRange(i + 2, 2).getValue();
        rowNumbers = JSON.parse(rowNumbersJson);
        break;
      }
    }

    const allEntries = [];
    if (rowNumbers.length > 0) {
      const diarySheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
      for (const rowNum of rowNumbers) {
        const range = diarySheet.getRange(rowNum, 1, 1, 5);
        const values = range.getValues()[0];
        const dateObj = values[0];
        if (dateObj instanceof Date && !isNaN(dateObj)) {
          allEntries.push({
            date: Utilities.formatDate(dateObj, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
            year: values[1],
            text: String(values[4] || '')
          });
        }
      }
    }
    return { allEntries: allEntries };
  } catch (error) {
    Logger.log(`Error in loadDiary: ${error.message}\n${error.stack}`);
    return { error: `日記の保存に失敗しました: ${error.message}` };
  }
}

function updateIndex(month, day, rowNum) {
  const indexSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(INDEX_SHEET_NAME);
  if (!indexSheet) {
    Logger.log(`インデックスシート "${INDEX_SHEET_NAME}" が見つからないため、インデックスを更新できませんでした。`);
    return;
  }
  const key = `${month}-${day}`; // 正しいテンプレートリテラルに修正
  let foundRowInIndex = -1;
  const lastIndexRow = indexSheet.getLastRow();
  // Indexシートにデータ行が1つ以上ある場合のみ、キーを検索する
  if (lastIndexRow > 1) { 
    const keyColumnValues = indexSheet.getRange(2, 1, lastIndexRow - 1, 1).getValues();
    for (let i = 0; i < keyColumnValues.length; i++) {
      if (keyColumnValues[i][0] == key) {
        foundRowInIndex = i + 2; // 実際の行番号
        break;
      }
    }
  }

  if (foundRowInIndex > -1) {
    const rowNumbersCell = indexSheet.getRange(foundRowInIndex, 2);
    const rowNumbersJson = rowNumbersCell.getValue();
    const rowNumbers = rowNumbersJson ? JSON.parse(rowNumbersJson) : [];
    if (!rowNumbers.includes(rowNum)) {
      rowNumbers.push(rowNum);
      rowNumbers.sort((a, b) => a - b);
      rowNumbersCell.setValue(JSON.stringify(rowNumbers));
      Logger.log(`Updated index for key "${key}", added row ${rowNum}`);
    }
  } else {
    indexSheet.appendRow(["'" + key, JSON.stringify([rowNum])]);
    Logger.log(`Created new index for key "${key}", added row ${rowNum}`);
  }
}

function searchDiary(payload) {
  try {
    const keyword = payload.keyword;
    if (!keyword) {
      return [];
    }
    const lowerCaseKeyword = keyword.toLowerCase();
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) {
      throw new Error(`シート "${SHEET_NAME}" が見つかりません。`);
    }
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];

    const dataRange = sheet.getRange(2, 1, lastRow - 1, 5);
    const data = dataRange.getValues();
    const results = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowDateStr = row[0] ? Utilities.formatDate(new Date(row[0]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '';
      const rowText = row[4] ? String(row[4]) : '';
      if (!rowDateStr || !rowText) continue;

      if (rowText.toLowerCase().includes(lowerCaseKeyword)) {
        results.push({
          date: rowDateStr,
          text: rowText
        });
      }
    }
     Logger.log(`Search for "${keyword}" found ${results.length} results.`);
    return results;
  } catch (error) {
    Logger.log(`Error in searchDiary: ${error.message}\n${error.stack}`);
    return { error: `日記の検索に失敗しました: ${error.message}` };
  }
}

/**
 * 【最終版 Ver.2】Gemini APIを呼び出し、与えられたテキストの要約を生成する
 * @param {string} text - 要約する日記の本文
 * @returns {string} - 生成された要約テキスト
 */
function generateSummary(text) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error('APIキーがスクリプトプロパティに設定されていません。');
  }
  if (!text) {
    return ''; // テキストが空なら要約も空
  }

  // 本文が70文字未満の場合は、要約せずに本文をそのまま返す
  if (text.trim().length < 70) {
    Logger.log('本文が短いため、要約せずにそのまま返します。');
    return text;
  }

  // 指示（プロンプト）を最終版に修正
  const prompt = `この日記を、です・ます調を避け、体言止めなどを活用した簡潔なスタイルで3〜4行で要約してください。重要なキーワードや感情が伝わるようにし、単なる箇条書きにはしないでください。また、本文中にある「〇月：」のような見出しは要約に含めないでください。\n\n---\n${text}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 200,
    }
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true // エラー時もレスポンスを取得するため
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (responseCode === 200) {
      const json = JSON.parse(responseBody);
      const summary = json.candidates?.[0]?.content?.parts?.[0]?.text || '要約の生成に失敗しました。';
      Logger.log('要約を生成しました。');
      // --- ▼▼▼ ここを変更！▼▼▼ ---
      return `* ${summary.trim()}`; // 先頭にアスタリスクとスペースを追加
      // --- ▲▲▲ ここを変更！▲▲▲ ---
    } else {
      Logger.log(`Gemini API Error Response: ${responseBody}`);
      return `* 要約生成エラー (Code: ${responseCode})`; // エラー時にもアスタリスクを付ける
    }
  } catch (e) {
    Logger.log(`UrlFetchApp Error: ${e.message}`);
    throw new Error(`APIの呼び出しに失敗しました: ${e.message}`);
  }
}

/**
 * 【改修】日記を保存し、インデックスと要約を更新する
 * @param {object} payload - { date: 'YYYY-MM-DD', year: number, month: number, day: number, text: string }
 */
function saveDiary(payload) {
  try {
    const { date, year, month, day, text } = payload;
    if (!date || !year || !month || !day || text === undefined || text === null) {
      throw new Error('保存データが不足しています。');
    }

    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error(`シート "${SHEET_NAME}" が見つかりません。`);

    let savedRowNum;
    const dateValues = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    let foundRowIndex = -1;

    for (let i = 0; i < dateValues.length; i++) {
      const rowDateStr = dateValues[i][0] ? Utilities.formatDate(new Date(dateValues[i][0]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '';
      if (rowDateStr === date) {
        foundRowIndex = i;
        break;
      }
    }
    
    let oldText = '';
    if (foundRowIndex > -1) {
      savedRowNum = foundRowIndex + 2;
      oldText = sheet.getRange(savedRowNum, 5).getValue(); // E列(Text)の既存の値を取得
      sheet.getRange(savedRowNum, 5).setValue(text); 
      Logger.log(`Updated row ${savedRowNum} for date ${date}`);
    } else {
      // 新規追加なのでoldTextは空のまま
      // Summary列も考慮してappendRow
      const newRowData = [date, year, month, day, text, '']; // Summaryは後で入れるので一旦空
      sheet.appendRow(newRowData);
      savedRowNum = sheet.getLastRow();
      Logger.log(`Appended new row for date ${date}`);
    }
    
    // 本文が変更された場合、または新規の場合のみ要約を生成
    if (text.trim() !== oldText.trim()) {
      const summary = generateSummary(text);
      sheet.getRange(savedRowNum, 6).setValue(summary); // F列(Summary)に書き込み
    }
    
    updateIndex(month, day, savedRowNum);

    return { message: '日記を保存しました。' };
  } catch (error) {
    Logger.log(`Error in saveDiary: ${error.message}\n${error.stack}`);
    return { error: `日記の保存に失敗しました: ${error.message}` };
  }
}


/**
 * 【改修】指定された年月のすべての日記（と要約）を取得する
 * @param {object} payload - { year: number, month: number }
 */
function getMonthlyDiary(payload) {
  try {
    const targetYear = payload.year;
    const targetMonth = payload.month;
    if (!targetYear || !targetMonth) throw new Error('年または月が指定されていません。');

    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error(`シート "${SHEET_NAME}" が見つかりません。`);

    const monthlyEntries = [];
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      // 取得範囲をF列(Summary)まで広げる
      const dataRange = sheet.getRange(2, 1, lastRow - 1, 6); 
      const data = dataRange.getValues();
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowYear = row[1] ? parseInt(row[1]) : null;
        const rowMonth = row[2] ? parseInt(row[2]) : null;

        if (rowYear === targetYear && rowMonth === targetMonth) {
           const rowDate = row[0] ? new Date(row[0]) : null;
           const rowText = row[4] ? String(row[4]) : '';
           const rowSummary = row[5] ? String(row[5]) : ''; // Summary(F列)を取得

           if(rowDate) {
             monthlyEntries.push({
               date: Utilities.formatDate(rowDate, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
               text: rowText,
               summary: rowSummary // 結果にsummaryを含める
             });
           }
        }
      }
    }

    monthlyEntries.sort((a, b) => a.date.localeCompare(b.date));
    Logger.log(`Found ${monthlyEntries.length} entries for ${targetYear}-${targetMonth}`);
    return monthlyEntries;

  } catch (error) {
    Logger.log(`Error in getMonthlyDiary: ${error.message}\n${error.stack}`);
    return { error: `月間日記の取得に失敗しました: ${error.message}` };
  }
}


/**
 * 【新規追加・初回実行用】既存の全日記の要約を生成する関数
 * GASエディタから一度だけ手動で実行してください。
 * 注意: 日記の件数が多い場合、実行時間が長くなり、APIの無料枠を超える可能性があります。
 */
function generateSummariesForOldEntries() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error(`シート "${SHEET_NAME}" が見つかりません。`);

  const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, 6); // F列まで
  const values = dataRange.getValues();
  let generatedCount = 0;

  for (let i = 0; i < values.length; i++) {
    const text = values[i][4];    // Text列
    const summary = values[i][5]; // Summary列

    // 本文があり、かつ要約がまだ無い場合のみ生成
    if (text && !summary) {
      try {
        const newSummary = generateSummary(text);
        sheet.getRange(i + 2, 6).setValue(newSummary); // F列に直接書き込み
        generatedCount++;
        Logger.log(`Row ${i + 2} の要約を生成しました。`);
        // APIのレート制限を避けるために1秒待機
        Utilities.sleep(1000); 
      } catch(e) {
        Logger.log(`Row ${i + 2} の要約生成中にエラーが発生しました: ${e.message}`);
      }
    }
  }

  Logger.log(`処理完了。${generatedCount}件の新しい要約を生成しました。`);
  // 下の行を削除またはコメントアウトしました
  // SpreadsheetApp.getUi().alert(`処理完了。\n${generatedCount}件の新しい要約を生成しました。`);
}


