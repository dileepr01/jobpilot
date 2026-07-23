import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
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

const STANDARD_HEADINGS = new Set([
  'PROFESSIONAL SUMMARY',
  'SUMMARY',
  'CORE SKILLS',
  'TECHNICAL SKILLS',
  'SKILLS',
  'PROFESSIONAL EXPERIENCE',
  'WORK EXPERIENCE',
  'EXPERIENCE',
  'EDUCATION',
  'CERTIFICATIONS',
  'AWARDS',
  'ACHIEVEMENTS',
  'PROJECTS'
])

export function safeResumeFilename(
  value: string
) {
  return value
    .replace(/[^a-z0-9 _-]/gi, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 90)
}

function isHeading(line: string) {
  return STANDARD_HEADINGS.has(
    line.trim().toUpperCase()
  )
}

function isBullet(line: string) {
  return /^[•*-]\s+/.test(line.trim())
}

function removeBullet(line: string) {
  return line
    .trim()
    .replace(/^[•*-]\s+/, '')
}

export {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
  isHeading,
  isBullet,
  removeBullet
}

export function createDocxResume(
  content: string
) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trimEnd())

  let nonEmptyLineNumber = 0

  const children = lines.map((line) => {
    const trimmed = line.trim()

    if (!trimmed) {
      return new Paragraph({
        spacing: { after: 60 }
      })
    }

    nonEmptyLineNumber += 1

    // Candidate name
    if (nonEmptyLineNumber === 1) {
      return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [
          new TextRun({
            text: trimmed,
            bold: true,
            size: 34,
            font: 'Arial'
          })
        ]
      })
    }

    // Contact information
    if (
      nonEmptyLineNumber === 2 &&
      !isHeading(trimmed)
    ) {
      return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 180 },
        children: [
          new TextRun({
            text: trimmed,
            size: 19,
            font: 'Arial',
            color: '444444'
          })
        ]
      })
    }

    // Standard ATS section heading
    if (isHeading(trimmed)) {
      return new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: {
          before: 220,
          after: 80
        },
        border: {
          bottom: {
            color: '444444',
            size: 6,
            space: 3,
            style: BorderStyle.SINGLE
          }
        },
        children: [
          new TextRun({
            text: trimmed.toUpperCase(),
            bold: true,
            size: 23,
            font: 'Arial'
          })
        ]
      })
    }

    // Resume bullet
    if (isBullet(trimmed)) {
      return new Paragraph({
        bullet: { level: 0 },
        spacing: {
          after: 45,
          line: 260
        },
        children: [
          new TextRun({
            text: removeBullet(trimmed),
            size: 20,
            font: 'Arial'
          })
        ]
      })
    }

    // Employer/title lines containing |
    const looksLikeExperienceHeading =
      /^[A-Z][^|]{2,100}\s+\|\s+/.test(
        trimmed
      )

    return new Paragraph({
      spacing: {
        after: 65,
        line: 260
      },
      children: [
        new TextRun({
          text: trimmed,
          bold: looksLikeExperienceHeading,
          size: 20,
          font: 'Arial'
        })
      ]
    })
  })

  return new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 650,
              right: 650,
              bottom: 650,
              left: 650
            }
          }
        },
        children
      }
    ]
  })
}

function wrapPdfText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
) {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current
      ? `${current} ${word}`
      : word

    if (
      font.widthOfTextAtSize(
        candidate,
        size
      ) <= maxWidth
    ) {
      current = candidate
    } else {
      if (current) {
        lines.push(current)
      }

      current = word
    }
  }

  if (current) {
    lines.push(current)
  }

  return lines
}

export async function createPdfResume(
  content: string
) {
  const pdf = await PDFDocument.create()

  const regular = await pdf.embedFont(
    StandardFonts.Helvetica
  )

  const bold = await pdf.embedFont(
    StandardFonts.HelveticaBold
  )

  const pageWidth = 595.28
  const pageHeight = 841.89
  const margin = 46
  const usableWidth =
    pageWidth - margin * 2

  let page: PDFPage = pdf.addPage([
    pageWidth,
    pageHeight
  ])

  let y = pageHeight - margin
  let nonEmptyLineNumber = 0

  function addNewPage() {
    page = pdf.addPage([
      pageWidth,
      pageHeight
    ])

    y = pageHeight - margin
  }

  function ensureSpace(
    requiredHeight: number
  ) {
    if (
      y - requiredHeight < margin
    ) {
      addNewPage()
    }
  }

  const sourceLines =
    content.split(/\r?\n/)

  for (const rawLine of sourceLines) {
    const line = rawLine.trim()

    if (!line) {
      y -= 7
      continue
    }

    nonEmptyLineNumber += 1

    const firstLine =
      nonEmptyLineNumber === 1

    const contactLine =
      nonEmptyLineNumber === 2 &&
      !isHeading(line)

    const heading = isHeading(line)
    const bullet = isBullet(line)

    const cleanLine = bullet
      ? removeBullet(line)
      : line

    const font =
      firstLine || heading
        ? bold
        : regular

    const fontSize = firstLine
      ? 17
      : heading
        ? 11.5
        : 10

    const indent = bullet ? 13 : 0

    const wrappedLines = wrapPdfText(
      cleanLine,
      font,
      fontSize,
      usableWidth - indent
    )

    const requiredHeight =
      wrappedLines.length *
        (fontSize + 3) +
      (heading ? 15 : 7)

    ensureSpace(requiredHeight)

    // Candidate name
    if (firstLine) {
      for (
        const wrappedLine
        of wrappedLines
      ) {
        const textWidth =
          font.widthOfTextAtSize(
            wrappedLine,
            fontSize
          )

        page.drawText(
          wrappedLine,
          {
            x: Math.max(
              margin,
              (
                pageWidth -
                textWidth
              ) / 2
            ),
            y,
            size: fontSize,
            font,
            color: rgb(
              0.05,
              0.05,
              0.05
            )
          }
        )

        y -= fontSize + 4
      }

      y -= 5
      continue
    }

    // Contact details
    if (contactLine) {
      for (
        const wrappedLine
        of wrappedLines
      ) {
        const textWidth =
          regular.widthOfTextAtSize(
            wrappedLine,
            fontSize
          )

        page.drawText(
          wrappedLine,
          {
            x: Math.max(
              margin,
              (
                pageWidth -
                textWidth
              ) / 2
            ),
            y,
            size: fontSize,
            font: regular,
            color: rgb(
              0.28,
              0.28,
              0.28
            )
          }
        )

        y -= fontSize + 3
      }

      y -= 8
      continue
    }

    // Standard ATS section heading
    if (heading) {
      y -= 5

      for (
        const wrappedLine
        of wrappedLines
      ) {
        page.drawText(
          wrappedLine.toUpperCase(),
          {
            x: margin,
            y,
            size: fontSize,
            font: bold,
            color: rgb(
              0.05,
              0.05,
              0.05
            )
          }
        )

        y -= fontSize + 3
      }

      page.drawLine({
        start: {
          x: margin,
          y: y + 2
        },
        end: {
          x: pageWidth - margin,
          y: y + 2
        },
        thickness: 0.7,
        color: rgb(
          0.35,
          0.35,
          0.35
        )
      })

      y -= 6
      continue
    }

    // Resume bullet or standard line
    for (
      let index = 0;
      index < wrappedLines.length;
      index += 1
    ) {
      if (
        bullet &&
        index === 0
      ) {
        page.drawText(
          '-',
          {
            x: margin,
            y,
            size: fontSize,
            font: regular
          }
        )
      }

      page.drawText(
        wrappedLines[index],
        {
          x: margin + indent,
          y,
          size: fontSize,
          font: regular,
          color: rgb(
            0.08,
            0.08,
            0.08
          )
        }
      )

      y -= fontSize + 3
    }

    y -= 3
  }

  return pdf.save()
}
