"use client"

import ChatGPTInput from "@/components/ui/prompt-input-dynamic-grow"
import FileUpload, { DropZone, FileError, FileList, FileInfo } from "@/components/ui/file-upload"
import { useState } from "react"

export default function Home() {
  const [uploadFiles, setUploadFiles] = useState<FileInfo[]>([])

  const onFileSelectChange = (files: FileInfo[]) => {
    setUploadFiles(files)
  }

  const onRemove = (fileId: string) => {
    setUploadFiles(uploadFiles.filter(file => file.id !== fileId))
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 gap-16">
      <div>
        <h1 className="text-2xl font-semibold text-center mb-8">Quiz App Components</h1>

        <FileUpload
          files={uploadFiles}
          onFileSelectChange={onFileSelectChange}
          multiple={true}
          accept=".pdf,.docx,.doc,.png,.jpg,.jpeg"
          maxSize={10}
          maxCount={3}
          className="w-96"
          disabled={false}
        >
          <div className="space-y-4">
            <DropZone prompt="Drop PDF files here" />
            <FileError />
            <FileList onClear={() => setUploadFiles([])} onRemove={onRemove} canResume />
          </div>
        </FileUpload>
      </div>

      <div className="w-full max-w-lg">
        <ChatGPTInput
          placeholder="Generate quiz about..."
          onSubmit={(value) => console.log("Submitted:", value)}
        />
      </div>
    </main>
  )
}
