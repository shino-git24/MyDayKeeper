/**
 * スプレッドシートを開いた時にカスタムメニューを追加する関数
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('日記ツール')
    .addItem('選択した行の要約を生成', 'generateSummaryForSelectedRows')
    .addSeparator() // メニューに区切り線を追加
    .addItem('インデックスを再構築', 'rebuildIndex')
    .addToUi();
}

 /**
 * 現在選択している行の要約を生成する関数
 */
function generateSummaryForSelectedRows() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('「DiaryData」シートが見つかりません。');
    return;
  }

  const activeRanges = sheet.getActiveRangeList().getRanges();
  if (activeRanges.length === 0) {
    SpreadsheetApp.getUi().alert('要約を生成したい行を選択してください。');
    return;
  }

  let generatedCount = 0;
  activeRanges.forEach(range => {
    // 選択された範囲の各行に対して処理を行う
    for (let i = range.getRow(); i <= range.getLastRow(); i++) {
      const textCell = sheet.getRange(i, 5); // E列（Text）
      const summaryCell = sheet.getRange(i, 6); // F列（Summary）
      const text = textCell.getValue();

      if (text && !summaryCell.getValue()) { // 本文があり、要約がまだ無い場合のみ
        try {
          const newSummary = generateSummary(text); // 既存の要約生成関数を呼び出す
          summaryCell.setValue(newSummary);
          generatedCount++;
        } catch (e) {
          Logger.log(`Row ${i} の要約生成中にエラー: ${e.message}`);
        }
      }
    }
  });

  if (generatedCount > 0) {
    SpreadsheetApp.getUi().alert(`${generatedCount}件の要約を生成しました。`);
  } else {
    SpreadsheetApp.getUi().alert('要約を生成する対象（本文があり、要約が空の行）が選択されていません。');
  }
}