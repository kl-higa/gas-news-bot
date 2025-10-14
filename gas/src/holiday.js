/**
 * holiday.js
 * 日本の祝日判定
 */

const HOLIDAY_CALENDAR_ID = 'ja.japanese#holiday@group.v.calendar.google.com';

/**
 * 指定日が日本の祝日かどうかを判定
 * @param {Date} date - 判定する日付
 * @returns {boolean}
 */
function isJapaneseHoliday(date) {
  try {
    const calendar = CalendarApp.getCalendarById(HOLIDAY_CALENDAR_ID);
    if (!calendar) {
      writeLog('ERROR', 'Holiday calendar not found');
      return false;
    }

    const events = calendar.getEventsForDay(date);
    return events.length > 0;

  } catch (e) {
    writeLog('ERROR', 'Failed to check holiday', { error: e.toString() });
    return false;
  }
}

/**
 * 指定日が土日または祝日かどうかを判定
 * @param {Date} date
 * @returns {boolean}
 */
function isWeekendOrHoliday(date) {
  const day = date.getDay();
  const isWeekend = (day === 0 || day === 6); // 日曜日=0, 土曜日=6
  return isWeekend || isJapaneseHoliday(date);
}

/**
 * 今日が平日かどうかを判定
 * @returns {boolean}
 */
function isTodayWorkday() {
  const today = new Date();
  return !isWeekendOrHoliday(today);
}
