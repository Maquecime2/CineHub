/* Le peu que les listes et le composeur de critère partagent. Il est
   court exprès, et il existe surtout pour ne pas faire de cycle :
   `ListsView` importe `CriterionComposer`, donc `CriterionComposer` ne
   peut pas importer `ListsView`. */

/** The month one is in, from the first to the last day: it is the period
    one wants nine times out of ten, and it is corrected in one click. */
export function currentMonth(): { start: string; end: string } {
  const d = new Date();
  const two = (n: number) => String(n).padStart(2, "0");
  const start = `${d.getFullYear()}-${two(d.getMonth() + 1)}-01`;
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const end = `${last.getFullYear()}-${two(last.getMonth() + 1)}-${two(last.getDate())}`;
  return { start, end };
}
