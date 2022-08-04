
//The n'th cutoff date. When n=0, its the cutoff of the current period; n=1
//that of the next period; n=2 that of the next period, etc.; n=-1 that
//of the previous period, etc.
export const cutoff = (n = 0, year:number, month:number) => {
    //Let $day0 be the first day of the current period.
    const day0 = `${year}-${month}-01`
    //Create a mew Date fromt first day of the month
    const date = new Date(day0);
    //Add the cutoff value to obtain the corret date
    //Formulate the date expression of the dayn e.g '2019-02-3 + 4 months'
    date.addMonths(n)
    //return the last dat of he month as the cuttoff
    return date.moveToLastDayOfMonth()
}