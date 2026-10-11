// @ts-expect-error - the engine ships as plain JS without types for this entry
import SocialCalc from 'socialcalc-core'

/** A SocialCalc workbook as written by socialcalc-mcp (MSC JSON). */
export type Workbook = {
  numsheets: number
  currentid: string
  sheetArr: Partial<
    Record<
      string,
      { name: string; sheetstr: { savestr: string }; hidden?: string }
    >
  >
}

const RECALC_TIMEOUT_MS = 4000

/**
 * Renders one sheet of a workbook to a DOM table with the SocialCalc engine.
 * socialcalc-mcp stores formulas without computed values, so the sheet is
 * recalculated here before it is drawn.
 */
export async function renderSheet(
  workbook: Workbook,
  sheetId = workbook.currentid,
): Promise<HTMLElement> {
  const entry =
    workbook.sheetArr[sheetId] ?? Object.values(workbook.sheetArr)[0]
  if (!entry) throw new Error('The workbook has no sheets')

  const sheet = new SocialCalc.Sheet()
  sheet.ParseSheetSave(entry.sheetstr.savestr)

  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, RECALC_TIMEOUT_MS)
    sheet.statuscallback = (_data: unknown, status: string) => {
      if (status === 'calcfinished') {
        clearTimeout(timer)
        resolve()
      }
    }
    sheet.RecalcSheet()
  })
  sheet.statuscallback = null

  const context = new SocialCalc.RenderContext(sheet)
  context.showGrid = true
  context.showRCHeaders = true
  return context.RenderSheet(null, { type: 'html' })
}
