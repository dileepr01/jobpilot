import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  TextRun
} from 'docx'
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage
} from 'pdf-lib'

const SECTION_HEADINGS = [
  'PROFESSIONAL SUMMARY',
  'SUMMARY',
  'CORE COMPETENCIES',
  'CORE SKILLS',
  'TECHNICAL SKILLS',
  'SKILLS',
  'PROFESSIONAL EXPERIENCE',
  'WORK EXPERIENCE',
  'EXPERIENCE',
  'SELECTED ACHIEVEMENTS',
  'KEY ACHIEVEMENTS',
  'ACHIEVEMENTS',
  'PROJECTS',
  'CERTIFICATIONS & PROFESSIONAL DEVELOPMENT',
  'CERTIFICATIONS',
  'EDUCATION & LANGUAGES',
  'EDUCATION',
  'LANGUAGES',
  'AWARDS'
] as const

const SECTION_SET = new Set<string>(SECTION_HEADINGS)

type BlockKind =
  | 'name'
  | 'title'
  | 'contact'
  | 'section'
  | 'role'
  | 'meta'
  | 'bullet'
  | 'body'

interface ResumeBlock {
  kind: BlockKind
  text: string
  section?: string
}

export function safeResumeFilename(value: string) {
  return value
    .replace(/[^a-z0-9 _-]/gi, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 90)
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function cleanLine(value: string) {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

function headingFor(value: string) {
  const upper = cleanLine(value).toUpperCase()
  return SECTION_SET.has(upper) ? upper : null
}

function containsContact(value: string) {
  return (
    /@/.test(value) ||
    /linkedin\.com/i.test(value) ||
    /(?:\+?\d[\d ()-]{7,}\d)/.test(value) ||
    /\b(?:Bengaluru|Bangalore|Hyderabad|Chennai|Pune|Mumbai|Delhi|Noida|Gurugram|India)\b/i.test(
      value
    )
  )
}

function structureFlattenedResume(content: string) {
  let text = content
    .replace(/\\n/g, '\n')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\bPage\s+\d+(?:\s+of\s+\d+)?\b/gi, ' ')

  const existingLines = text
    .split('\n')
    .map(cleanLine)
    .filter(Boolean)

  if (existingLines.length >= 8) return text

  const headings = [...SECTION_HEADINGS]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex)
    .join('|')

  text = text.replace(
    new RegExp(`\\s*(${headings})\\s*`, 'g'),
    '\n$1\n'
  )

  text = text.replace(/\s*[•●▪◦]\s*/g, '\n- ')

  const rolePattern =
    /\s+(?=(?:Senior Software Engineer|Technology Lead|Associate IT Analyst|Principal Engineer|Lead Engineer|Senior Engineer|BI Platform Engineer|Power BI Administrator)\b)/gi

  text = text.replace(rolePattern, '\n')

  return text
}

function normalizeResume(content: string) {
  const lines = structureFlattenedResume(content)
    .split('\n')
    .map(cleanLine)
    .filter(Boolean)

  const result: string[] = []

  for (const line of lines) {
    const heading = headingFor(line)
    const normalized = heading || line

    if (
      result.length > 0 &&
      result[result.length - 1].toLowerCase() === normalized.toLowerCase()
    ) {
      continue
    }

    result.push(normalized)
  }

  if (result.length === 1 && result[0].includes('|')) {
    const parts = result[0]
      .split(/\s*\|\s*/)
      .map(cleanLine)
      .filter(Boolean)

    return parts.join('\n')
  }

  return result.join('\n')
}

function looksLikeRole(value: string) {
  if (containsContact(value)) return false

  return (
    /\b(?:Senior|Lead|Principal|Staff|Technology|Associate|Consultant|Manager|Engineer|Administrator|Developer|Analyst|Architect)\b/i.test(
      value
    ) &&
    (/[|—–]/.test(value) || value.length < 110)
  )
}

function looksLikeMeta(value: string) {
  return (
    /\b(?:19|20)\d{2}\b/.test(value) ||
    /\b(?:Present|Current)\b/i.test(value) ||
    (/\b(?:India|Bengaluru|Bangalore|Hyderabad|Chennai|Pune|Mumbai|Delhi|Noida|Gurugram)\b/i.test(
      value
    ) &&
      value.length < 140)
  )
}

function parseBlocks(content: string): ResumeBlock[] {
  const lines = normalizeResume(content)
    .split('\n')
    .map(cleanLine)
    .filter(Boolean)

  const blocks: ResumeBlock[] = []
  let currentSection = ''
  let headerIndex = 0

  for (const line of lines) {
    const heading = headingFor(line)

    if (heading) {
      currentSection = heading
      blocks.push({
        kind: 'section',
        text: heading,
        section: heading
      })
      continue
    }

    if (!currentSection && headerIndex < 3) {
      const kind: BlockKind =
        headerIndex === 0
          ? 'name'
          : headerIndex === 1
            ? 'title'
            : 'contact'

      blocks.push({ kind, text: line })
      headerIndex += 1
      continue
    }

    if (/^[•●▪◦*-]\s*/.test(line)) {
      blocks.push({
        kind: 'bullet',
        text: line.replace(/^[•●▪◦*-]\s*/, ''),
        section: currentSection
      })
      continue
    }

    if (
      currentSection.includes('EXPERIENCE') &&
      looksLikeRole(line)
    ) {
      blocks.push({
        kind: 'role',
        text: line,
        section: currentSection
      })
      continue
    }

    if (
      currentSection.includes('EXPERIENCE') &&
      looksLikeMeta(line)
    ) {
      blocks.push({
        kind: 'meta',
        text: line,
        section: currentSection
      })
      continue
    }

    blocks.push({
      kind: 'body',
      text: line,
      section: currentSection
    })
  }

  return blocks
}

function preferredPageBreak(blocks: ResumeBlock[]) {
  const roleIndexes = blocks
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => block.kind === 'role')
    .map(({ index }) => index)

  if (roleIndexes.length >= 2) return roleIndexes[1]

  const totalCharacters = blocks.reduce(
    (sum, block) => sum + block.text.length,
    0
  )

  if (totalCharacters < 2400) return -1

  const midpoint = Math.floor(blocks.length * 0.55)
  const cleanBreak = blocks.findIndex(
    (block, index) =>
      index >= midpoint &&
      (block.kind === 'section' || block.kind === 'role')
  )

  return cleanBreak >= 0 ? cleanBreak : midpoint
}

export function createDocxResume(content: string) {
  const blocks = parseBlocks(content)
  const pageBreakAt = preferredPageBreak(blocks)
  const children: Paragraph[] = []

  blocks.forEach((block, index) => {
    if (index === pageBreakAt) {
      children.push(
        new Paragraph({
          children: [new PageBreak()]
        })
      )
    }

    if (block.kind === 'name') {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [
            new TextRun({
              text: block.text,
              bold: true,
              size: 34,
              font: 'Arial',
              color: '17365D'
            })
          ]
        })
      )
      return
    }

    if (block.kind === 'title') {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 55 },
          children: [
            new TextRun({
              text: block.text,
              bold: true,
              size: 21,
              font: 'Arial',
              color: '2F5597'
            })
          ]
        })
      )
      return
    }

    if (block.kind === 'contact') {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 180 },
          children: [
            new TextRun({
              text: block.text,
              size: 18,
              font: 'Arial',
              color: '555555'
            })
          ]
        })
      )
      return
    }

    if (block.kind === 'section') {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          keepNext: true,
          spacing: {
            before: 220,
            after: 80
          },
          border: {
            bottom: {
              color: '2F5597',
              size: 7,
              space: 3,
              style: BorderStyle.SINGLE
            }
          },
          children: [
            new TextRun({
              text: block.text,
              bold: true,
              size: 22,
              font: 'Arial',
              color: '2F5597'
            })
          ]
        })
      )
      return
    }

    if (block.kind === 'role') {
      children.push(
        new Paragraph({
          keepNext: true,
          spacing: {
            before: 130,
            after: 25
          },
          children: [
            new TextRun({
              text: block.text,
              bold: true,
              size: 21,
              font: 'Arial',
              color: '1F1F1F'
            })
          ]
        })
      )
      return
    }

    if (block.kind === 'meta') {
      children.push(
        new Paragraph({
          keepNext: true,
          spacing: { after: 65 },
          children: [
            new TextRun({
              text: block.text,
              italics: true,
              size: 18,
              font: 'Arial',
              color: '555555'
            })
          ]
        })
      )
      return
    }

    if (block.kind === 'bullet') {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: {
            after: 55,
            line: 255
          },
          children: [
            new TextRun({
              text: block.text,
              size: 19,
              font: 'Arial'
            })
          ]
        })
      )
      return
    }

    children.push(
      new Paragraph({
        spacing: {
          after: 80,
          line: 255
        },
        children: [
          new TextRun({
            text: block.text,
            size: 19,
            font: 'Arial'
          })
        ]
      })
    )
  })

  return new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Arial',
            size: 19
          },
          paragraph: {
            spacing: {
              line: 255
            }
          }
        }
      }
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 650,
              right: 720,
              bottom: 720,
              left: 720
            }
          }
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'Page ',
                    size: 16,
                    color: '777777'
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: '777777'
                  }),
                  new TextRun({
                    text: ' of ',
                    size: 16,
                    color: '777777'
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    color: '777777'
                  })
                ]
              })
            ]
          })
        },
        children
      }
    ]
  })
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
) {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word

    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate
    } else {
      if (current) lines.push(current)
      current = word
    }
  }

  if (current) lines.push(current)
  return lines
}

export async function createPdfResume(content: string) {
  const blocks = parseBlocks(content)
  const preferredBreak = preferredPageBreak(blocks)

  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const oblique = await pdf.embedFont(StandardFonts.HelveticaOblique)

  const pageWidth = 595.28
  const pageHeight = 841.89
  const marginX = 48
  const marginTop = 46
  const marginBottom = 52
  const usableWidth = pageWidth - marginX * 2

  let page: PDFPage
  let y = 0
  let pageNumber = 0

  function addPage() {
    page = pdf.addPage([pageWidth, pageHeight])
    pageNumber += 1
    y = pageHeight - marginTop
  }

  function footer() {
    const text = `Page ${pageNumber}`
    const width = regular.widthOfTextAtSize(text, 8)
    page.drawText(text, {
      x: (pageWidth - width) / 2,
      y: 22,
      size: 8,
      font: regular,
      color: rgb(0.45, 0.45, 0.45)
    })
  }

  function ensureSpace(height: number) {
    if (y - height < marginBottom) {
      footer()
      addPage()
    }
  }

  addPage()

  blocks.forEach((block, index) => {
    if (index === preferredBreak && pageNumber === 1) {
      footer()
      addPage()
    }

    const isName = block.kind === 'name'
    const isTitle = block.kind === 'title'
    const isContact = block.kind === 'contact'
    const isSection = block.kind === 'section'
    const isRole = block.kind === 'role'
    const isMeta = block.kind === 'meta'
    const isBullet = block.kind === 'bullet'

    const font =
      isName || isSection || isRole
        ? bold
        : isMeta
          ? oblique
          : regular

    const fontSize = isName
      ? 17
      : isTitle
        ? 10.5
        : isContact
          ? 8.7
          : isSection
            ? 11.2
            : isRole
              ? 10.3
              : isMeta
                ? 8.8
                : 9.4

    const indent = isBullet ? 14 : 0
    const wrapped = wrapText(
      block.text,
      font,
      fontSize,
      usableWidth - indent
    )

    const lineHeight = fontSize + 3
    const extra = isName
      ? 10
      : isTitle
        ? 8
        : isContact
          ? 14
          : isSection
            ? 15
            : isRole
              ? 8
              : isMeta
                ? 6
                : 5

    ensureSpace(wrapped.length * lineHeight + extra)

    if (isSection) {
      y -= 7
      page.drawText(block.text, {
        x: marginX,
        y,
        size: fontSize,
        font: bold,
        color: rgb(0.18, 0.34, 0.59)
      })

      y -= fontSize + 3

      page.drawLine({
        start: { x: marginX, y: y + 2 },
        end: { x: pageWidth - marginX, y: y + 2 },
        thickness: 0.8,
        color: rgb(0.18, 0.34, 0.59)
      })

      y -= 7
      return
    }

    for (
      let lineIndex = 0;
      lineIndex < wrapped.length;
      lineIndex += 1
    ) {
      const line = wrapped[lineIndex]
      let x = marginX + indent

      if (isName || isTitle || isContact) {
        const width = font.widthOfTextAtSize(line, fontSize)
        x = Math.max(marginX, (pageWidth - width) / 2)
      }

      if (isBullet && lineIndex === 0) {
        page.drawCircle({
          x: marginX + 3,
          y: y + 3,
          size: 1.7,
          color: rgb(0.12, 0.12, 0.12)
        })
      }

      page.drawText(line, {
        x,
        y,
        size: fontSize,
        font,
        color:
          isName || isTitle
            ? rgb(0.09, 0.21, 0.38)
            : isContact || isMeta
              ? rgb(0.34, 0.34, 0.34)
              : rgb(0.08, 0.08, 0.08)
      })

      y -= lineHeight
    }

    y -= extra
  })

  footer()

  const pages = pdf.getPages()
  pages.forEach((pdfPage, index) => {
    const totalText = `Page ${index + 1} of ${pages.length}`
    const width = regular.widthOfTextAtSize(totalText, 8)

    pdfPage.drawRectangle({
      x: (pageWidth - width) / 2 - 4,
      y: 18,
      width: width + 8,
      height: 12,
      color: rgb(1, 1, 1)
    })

    pdfPage.drawText(totalText, {
      x: (pageWidth - width) / 2,
      y: 22,
      size: 8,
      font: regular,
      color: rgb(0.45, 0.45, 0.45)
    })
  })

  return pdf.save()
}

export {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun
}
