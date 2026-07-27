'use client'

import { useMemo } from 'react'
import { CKEditor } from '@ckeditor/ckeditor5-react'
import {
  Alignment,
  AutoImage,
  AutoLink,
  BlockQuote,
  Bold,
  ClassicEditor,
  Code,
  CodeBlock,
  Essentials,
  FileRepository,
  Fullscreen,
  GeneralHtmlSupport,
  Heading,
  HorizontalLine,
  HtmlEmbed,
  Image,
  ImageCaption,
  ImageInsert,
  ImageResize,
  ImageStyle,
  ImageToolbar,
  ImageUpload,
  Indent,
  IndentBlock,
  Italic,
  Link,
  LinkImage,
  List,
  MediaEmbed,
  Paragraph,
  RemoveFormat,
  SourceEditing,
  Strikethrough,
  Table,
  TableColumnResize,
  TableToolbar,
  TodoList,
  Underline,
  type Editor,
} from 'ckeditor5'
import { useSessionContext } from '@/context/SessionContext'
import 'ckeditor5/ckeditor5.css'
import './BlogRichTextEditor.css'

type BlogRichTextEditorProps = {
  value: string
  onChange: (html: string) => void
}

const plugins = [
  Essentials,
  Paragraph,
  Heading,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Link,
  AutoLink,
  List,
  TodoList,
  Alignment,
  Indent,
  IndentBlock,
  BlockQuote,
  CodeBlock,
  HorizontalLine,
  RemoveFormat,
  Image,
  ImageInsert,
  AutoImage,
  ImageCaption,
  ImageResize,
  ImageStyle,
  ImageToolbar,
  ImageUpload,
  LinkImage,
  MediaEmbed,
  Table,
  TableToolbar,
  TableColumnResize,
  GeneralHtmlSupport,
  HtmlEmbed,
  SourceEditing,
  Fullscreen,
]

function createBlogImageUploadPlugin(accessToken: string) {
  return function blogImageUploadPlugin(editor: Editor) {
    const fileRepository = editor.plugins.get(FileRepository)

    fileRepository.createUploadAdapter = (loader) => {
      const controller = new AbortController()

      return {
        async upload() {
          const file = await loader.file
          if (!file) throw new Error('Select an image to upload.')
          if (!accessToken) throw new Error('Your session has expired. Sign in again before uploading an image.')

          const formData = new FormData()
          formData.set('file', file, file.name)
          const response = await fetch('/api/blogs/images', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            body: formData,
            signal: controller.signal,
          })
          const result = (await response.json().catch(() => null)) as { url?: string; error?: string } | null

          if (!response.ok || !result?.url) {
            throw new Error(result?.error || 'Unable to upload the image.')
          }

          return { default: result.url }
        },
        abort() {
          controller.abort()
        },
      }
    }
  }
}

export default function BlogRichTextEditor({ value, onChange }: BlogRichTextEditorProps) {
  const { token } = useSessionContext()
  const accessToken = token?.trim() || ''
  const uploadPlugin = useMemo(() => createBlogImageUploadPlugin(accessToken), [accessToken])

  return (
    <div className="blog-ckeditor overflow-hidden rounded-xl border border-slate-700 bg-[#0b1323] text-slate-100">
      <CKEditor
        editor={ClassicEditor}
        data={value || '<p></p>'}
        config={{
          licenseKey: process.env.NEXT_PUBLIC_CKEDITOR_LICENSE_KEY || 'GPL',
          plugins,
          extraPlugins: [uploadPlugin],
          toolbar: {
            items: [
              'undo',
              'redo',
              '|',
              'sourceEditing',
              'fullscreen',
              '|',
              'heading',
              '|',
              'bold',
              'italic',
              'underline',
              'strikethrough',
              'code',
              'removeFormat',
              '|',
              'alignment',
              'bulletedList',
              'numberedList',
              'todoList',
              'outdent',
              'indent',
              '|',
              'link',
              'insertImage',
              'mediaEmbed',
              'insertTable',
              'blockQuote',
              'codeBlock',
              'horizontalLine',
              'htmlEmbed',
            ],
            shouldNotGroupWhenFull: true,
          },
          heading: {
            options: [
              { model: 'paragraph', title: 'Paragraph', class: 'ck-heading_paragraph' },
              { model: 'heading2', view: 'h2', title: 'Heading 2', class: 'ck-heading_heading2' },
              { model: 'heading3', view: 'h3', title: 'Heading 3', class: 'ck-heading_heading3' },
              { model: 'heading4', view: 'h4', title: 'Heading 4', class: 'ck-heading_heading4' },
            ],
          },
          image: {
            toolbar: [
              'imageTextAlternative',
              'toggleImageCaption',
              '|',
              'imageStyle:inline',
              'imageStyle:wrapText',
              'imageStyle:breakText',
              '|',
              'resizeImage',
              'linkImage',
            ],
          },
          table: {
            contentToolbar: [
              'tableColumn',
              'tableRow',
              'mergeTableCells',
              '|',
              'toggleTableCaption',
            ],
          },
          htmlSupport: {
            allow: [
              {
                name: /.*/,
                attributes: true,
                classes: true,
                styles: true,
              },
            ],
          },
          link: {
            addTargetToExternalLinks: true,
            defaultProtocol: 'https://',
            decorators: {
              openInNewTab: {
                mode: 'manual',
                label: 'Open in a new tab',
                attributes: {
                  target: '_blank',
                  rel: 'noopener noreferrer',
                },
              },
            },
          },
          mediaEmbed: {
            previewsInData: true,
          },
        }}
        onChange={(_event, editor) => onChange(editor.getData())}
      />
    </div>
  )
}
