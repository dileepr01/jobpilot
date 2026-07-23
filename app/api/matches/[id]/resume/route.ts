import { createClient } from '@/lib/supabase/server'
import {
  createDocxResume,
  createPdfResume,
  Packer,
  safeResumeFilename
} from '@/lib/resume-documents'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(
  request: Request,
  {
    params
  }: {
    params: { id: string }
  }
) {
  const supabase = createClient()

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const requestUrl = new URL(request.url)

  const format =
    requestUrl.searchParams.get('format') === 'pdf'
      ? 'pdf'
      : 'docx'

  const { data: match, error } = await supabase
    .from('matches')
    .select(`
      tailored_resume,
      jobs!inner(title, company)
    `)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (error || !match) {
    return Response.json(
      { error: 'Match not found' },
      { status: 404 }
    )
  }

  const resume = match.tailored_resume as {
    template?: string
    content?: string
  } | null

  if (!resume?.content) {
    return Response.json(
      {
        error:
          'Create and save an ATS resume first'
      },
      { status: 400 }
    )
  }

  const job = match.jobs as unknown as {
    title: string
    company: string
  }

  const filename = safeResumeFilename(
    `${job.title}_${job.company}_Resume`
  )

  if (format === 'pdf') {
    const pdfBytes = await createPdfResume(
      resume.content
    )

    return new Response(
      new Uint8Array(pdfBytes),
      {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition':
            `attachment; filename="${filename}.pdf"`,
          'Cache-Control': 'private, no-store'
        }
      }
    )
  }

  const document = createDocxResume(
    resume.content
  )

  const docxBuffer =
    await Packer.toBuffer(document)

  return new Response(
    new Uint8Array(docxBuffer),
    {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition':
          `attachment; filename="${filename}.docx"`,
        'Cache-Control': 'private, no-store'
      }
    }
  )
}
