/**
 * Validates a date-only value in YYYY-MM-DD format.
 *
 * This intentionally avoids parsing date-only strings with
 * new Date(string), which can introduce timezone confusion.
 */
export function isValidDateOnly(value: string): boolean {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if(!match) return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if(month<1||month>12||day<1)    return false;
    const daysInMonth = new Date(
        Date.UTC(year, month, 0),
    ).getUTCDate();
    return day <= daysInMonth;
}

/**
 * Returns the difference in calendar days:
 * dueDate - today.
 */
export function getDaysBetweenDateOnly(
    dueDate: string,
    today: string,
): number {
    if(!isValidDateOnly(dueDate)) {
        throw new Error(`Invalid due date: ${dueDate}`);
    }
    if(!isValidDateOnly(today)) {
        throw new Error(`Invalid today date: ${today}`);
    }
    const [dueYear, dueMonth, dueDay] = dueDate.split("-").map(Number);
    const [todayYear, todayMonth, todayDay] = today.split("-").map(Number);
    const dueTimestamp = Date.UTC(dueYear, dueMonth-1,dueDay);
    const todayTimestamp = Date.UTC(todayYear, todayMonth-1, todayDay);
    return (dueTimestamp - todayTimestamp)/86_400_000;
}