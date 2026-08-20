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

const HEADING_VARIANTS = [
  {
    value: 'PROFESSIONAL EXPERIENCE - CONTINUED',
    canonical: 'PROFESSIONAL EXPERIENCE'
  },
  {
    value: 'PROFESSIONAL EXPERIENCE – CONTINUED',
    canonical: 'PROFESSIONAL EXPERIENCE'
  },
  ...SECTION_HEADINGS.map((value) => ({ value, canonical: value }))
].sort((left, right) => right.value.length - left.value.length)

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

interface ResumeHeader {
  name: string
  title: string
  contact: string
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
    .replace(/\s+([,;:])/g, '$1')
    .trim()
}

function headingFor(value: string) {
  const upper = cleanLine(value)
    .replace(/\s+[–-]\s+CONTINUED$/i, '')
    .toUpperCase()

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

function normalizedInput(content: string) {
  return content
    .replace(/\\n/g, '\n')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\bPage\s+\d+(?:\s+of\s+\d+)?\b/gi, ' ')
    .replace(/[ \t]+/g, ' ')
}

function firstSectionIndex(text: string) {
  let first = -1

  for (const { value } of HEADING_VARIANTS) {
    const index = text.indexOf(value)
    if (index >= 0 && (first < 0 || index < first)) first = index
  }

  return first
}

function extractHeader(headerText: string): ResumeHeader {
  const compact = cleanLine(headerText.replace(/\n+/g, ' '))
  const pieces = compact
    .split(/\s*\|\s*/)
    .map(cleanLine)
    .filter(Boolean)

  const name = cleanLine(pieces[0] || '')
  const title = cleanLine(
    pieces.find(
      (piece, index) =>
        index > 0 &&
        !containsContact(piece) &&
        !/^page\s+\d+/i.test(piece) &&
        !name.toLowerCase().includes(piece.toLowerCase())
    ) || ''
  )

  const email = compact.match(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
  )?.[0]

  const linkedin = compact.match(
    /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[^\s|]+/i
  )?.[0]

  const phone = compact.match(
    /(?:\+?\d[\d ()-]{7,}\d)/
  )?.[0]

  const firstContactIndex = [email, linkedin, phone]
    .filter((value): value is string => Boolean(value))
    .map((value) => compact.indexOf(value))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0]

  let location = ''
  if (firstContactIndex !== undefined) {
    const beforeContact = compact
      .slice(0, firstContactIndex)
      .replace(/[|\s]+$/g, '')

    location =
      beforeContact.match(
        /([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,2},\s*(?:India|USA|United States|UK|Canada|Australia|UAE))$/i
      )?.[1] || ''
  }

  const contact = [location, phone, email, linkedin]
    .filter(Boolean)
    .join(' | ')

  const fallbackLines = headerText
    .split('\n')
    .map(cleanLine)
    .filter(Boolean)

  return {
    name: name || fallbackLines[0] || 'Candidate',
    title:
      title ||
      fallbackLines.find(
        (line, index) => index > 0 && !containsContact(line)
      ) ||
      'Professional Profile',
    contact:
      contact ||
      fallbackLines.find((line) => containsContact(line)) ||
      ''
  }
}

function removeRepeatedHeader(
  value: string,
  header: ResumeHeader
) {
  let text = value

  if (header.name && header.title) {
    const exactHeader = new RegExp(
      `${escapeRegex(header.name)}\\s*\\|\\s*${escapeRegex(
        header.title
      )}\\s*\\|?`,
      'gi'
    )
    text = text.replace(exactHeader, ' ')
  }

  if (header.name) {
    text = text.replace(
      new RegExp(`\\s+${escapeRegex(header.name)}\\s+(?=${escapeRegex(header.title)})`, 'gi'),
      ' '
    )
  }

  return text
}

function addStructureBreaks(value: string) {
  let text = value

  for (const { value: variant, canonical } of HEADING_VARIANTS) {
    text = text.replace(
      new RegExp(`\\s*${escapeRegex(variant)}\\s*`, 'g'),
      `\n${canonical}\n`
    )
  }

  text = text
    .replace(/\s*[•●▪◦]\s*/g, '\n- ')
    .replace(/\n\s*[-*]\s+/g, '\n- ')

  return text
}

export function normalizeResumeForExport(content: string) {
  const text = normalizedInput(content)
  const sectionIndex = firstSectionIndex(text)

  if (sectionIndex < 0) {
    return text
      .split('\n')
      .map(cleanLine)
      .filter(Boolean)
      .join('\n')
  }

  const header = extractHeader(text.slice(0, sectionIndex))
  const body = addStructureBreaks(
    removeRepeatedHeader(text.slice(sectionIndex), header)
  )

  const bodyLines = body
    .split('\n')
    .map(cleanLine)
    .filter(Boolean)

  const result = [header.name, header.title]
  if (header.contact) result.push(header.contact)

  let currentSection = ''

  for (const line of bodyLines) {
    const heading = headingFor(line)

    if (heading) {
      if (heading === currentSection) continue
      currentSection = heading
      result.push(heading)
      continue
    }

    const normalized = cleanLine(line)
    if (!normalized) continue

    if (
      normalized.toLowerCase() === header.name.toLowerCase() ||
      normalized.toLowerCase() === header.title.toLowerCase() ||
      (header.contact &&
        normalized.toLowerCase() === header.contact.toLowerCase())
    ) {
      continue
    }

    if (
      result.length > 0 &&
      result[result.length - 1].toLowerCase() === normalized.toLowerCase()
    ) {
      continue
    }

    result.push(normalized)
  }

  return result.join('\n')
}

function looksLikeRole(value: string) {
  if (containsContact(value)) return false

  return (
    /\b(?:Senior|Lead|Principal|Staff|Technology|Associate|Consultant|Manager|Engineer|Administrator|Developer|Analyst|Architect|Director|Specialist)\b/i.test(
      value
    ) &&
    value.length < 170
  )
}

function looksLikeMeta(value: string) {
  return (
    /\b(?:19|20)\d{2}\b/.test(value) ||
    /\b(?:Present|Current)\b/i.test(value) ||
    (/\b(?:India|Bengaluru|Bangalore|Hyderabad|Chennai|Pune|Mumbai|Delhi|Noida|Gurugram)\b/i.test(
      value
    ) &&
      value.length < 180)
  )
}

function parseBlocks(content: string): ResumeBlock[] {
  const lines = normalizeResumeForExport(content)
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

    if (currentSection.includes('EXPERIENCE')) {
      const [possibleRole, ...metaParts] = line
        .split(/\s*\|\s*/)
        .map(cleanLine)
        .filter(Boolean)

      if (looksLikeRole(possibleRole)) {
        blocks.push({
          kind: 'role',
          text: possibleRole,
          section: currentSection
        })

        const meta = metaParts.join(' | ')
        if (meta) {
          blocks.push({
            kind: 'meta',
            text: meta,
            section: currentSection
          })
        }
        continue
      }

      if (looksLikeMeta(line)) {
        blocks.push({
          kind: 'meta',
          text: line,
          section: currentSection
        })
        continue
      }
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
          spacing: { after: 70 },
          children: [
            new TextRun({
              text: block.text,
              bold: true,
              size: 32,
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
          spacing: { after: 45 },
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
          spacing: { after: 160 },
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
          spacing: { before: 190, after: 70 },
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
              size: 21,
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
          spacing: { before: 120, after: 20 },
          children: [
            new TextRun({
              text: block.text,
              bold: true,
              size: 20,
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
          spacing: { after: 55 },
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
          spacing: { after: 45, line: 250 },
          children: [
            new TextRun({
              text: block.text,
              size: 18,
              font: 'Arial'
            })
          ]
        })
      )
      return
    }

    children.push(
      new Paragraph({
        spacing: { after: 70, line: 250 },
        children: [
          new TextRun({
            text: block.text,
            size: 18,
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
          run: { font: 'Arial', size: 18 },
          paragraph: { spacing: { line: 250 } }
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
  const marginTop = 44
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

  function drawFooter() {
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
      drawFooter()
      addPage()
    }
  }

  addPage()

  blocks.forEach((block, index) => {
    if (index === preferredBreak && pageNumber === 1) {
      drawFooter()
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
      ? 16
      : isTitle
        ? 10.5
        : isContact
          ? 8.5
          : isSection
            ? 10.8
            : isRole
              ? 10
              : isMeta
                ? 8.6
                : 9.1

    const indent = isBullet ? 14 : 0
    const wrapped = wrapText(
      block.text,
      font,
      fontSize,
      usableWidth - indent
    )

    const lineHeight = fontSize + 3
    const extra = isName
      ? 8
      : isTitle
        ? 6
        : isContact
          ? 12
          : isSection
            ? 13
            : isRole
              ? 6
              : isMeta
                ? 5
                : 4

    ensureSpace(wrapped.length * lineHeight + extra)

    if (isSection) {
      y -= 5
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
      y -= 6
      return
    }

    wrapped.forEach((line, lineIndex) => {
      let x = marginX + indent

      if (isName || isTitle || isContact) {
        const width = font.widthOfTextAtSize(line, fontSize)
        x = Math.max(marginX, (pageWidth - width) / 2)
      }

      if (isBullet && lineIndex === 0) {
        page.drawCircle({
          x: marginX + 3,
          y: y + 3,
          size: 1.6,
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
    })

    y -= extra
  })

  drawFooter()

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
