import mammoth from 'mammoth'
import { extractText, getDocumentProxy } from 'unpdf'
import { normalizeWhitespace } from '@/lib/utils'

const PDF = 'application/pdf'
const DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export async function parseResume(file: File) {
  if (file.size > 4 * 1024 * 1024) {
    throw new Error('Resume must be 4 MB or smaller')
  }

  const isPdf =
    file.type === PDF || file.name.toLowerCase().endsWith('.pdf')

  const isDocx =
    file.type === DOCX || file.name.toLowerCase().endsWith('.docx')

  if (!isPdf && !isDocx) {
    throw new Error('Only PDF and DOCX resumes are supported')
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  if (isPdf && buffer.subarray(0, 4).toString() !== '%PDF') {
    throw new Error('The uploaded PDF signature is invalid')
  }

  if (isDocx && buffer.subarray(0, 2).toString() !== 'PK') {
    throw new Error('The uploaded DOCX signature is invalid')
  }

  let text = ''

  if (isPdf) {
    const document = await getDocumentProxy(new Uint8Array(buffer))

    const result = await extractText(document, {
      mergePages: true
    })

    text = result.text
  } else {
    text = (
      await mammoth.extractRawText({
        buffer
      })
    ).value
  }

  const cleaned = normalizeWhitespace(text)

  if (cleaned.length < 120) {
    throw new Error(
      'The resume did not contain enough readable text. Scanned PDFs may require OCR.'
    )
  }

  if (cleaned.length > 200_000) {
    throw new Error(
      'The resume contains unexpectedly large extracted text'
    )
  }

  return cleaned
}
