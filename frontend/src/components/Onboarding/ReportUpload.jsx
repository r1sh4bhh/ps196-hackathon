import React, { useRef, useState } from "react";
import { parseReportFile, supportedExtensions } from "../../utils/reportParser";
import { saveReport, removeReport } from "../../storage/reportStore";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function extensionOf(fileName = "") {
  const match = /\.([a-z0-9]+)$/i.exec(fileName);
  return match ? match[1].toLowerCase() : "";
}

export default function ReportUpload({ observations, onObservationsChange }) {
  const [files, setFiles] = useState([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef(null);

  const updateFile = (id, patch) => {
    setFiles((previous) => previous.map((file) => (file.id === id ? { ...file, ...patch } : file)));
  };

  const processFile = async (file) => {
    const id = `${file.name}-${file.size}-${Date.now()}`;
    const extension = extensionOf(file.name);

    if (!supportedExtensions().includes(extension)) {
      setFiles((previous) => [
        ...previous,
        { id, name: file.name, size: file.size, status: "failed", error: "Unsupported file type" },
      ]);
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFiles((previous) => [
        ...previous,
        {
          id,
          name: file.name,
          size: file.size,
          status: "failed",
          error: "File exceeds 10 MB limit",
        },
      ]);
      return;
    }

    setFiles((previous) => [
      ...previous,
      { id, name: file.name, size: file.size, status: "parsing", error: null, observations: [] },
    ]);

    try {
      const parsed = await parseReportFile(file);
      const taggedObservations = parsed.map((observation) => ({
        ...observation,
        __fileId: id,
      }));

      updateFile(id, { status: "parsed", observations: taggedObservations });
      await saveReport(
        {
          id,
          fileName: file.name,
          size: file.size,
          type: file.type,
          observations: taggedObservations,
        },
        file
      );

      onObservationsChange([...(observations || []), ...taggedObservations]);
    } catch (error) {
      updateFile(id, { status: "failed", error: error.message || "Failed to parse file" });
    }
  };

  const handleFiles = (fileList) => {
    Array.from(fileList || []).forEach((file) => {
      processFile(file);
    });
  };

  const handleRemove = async (id) => {
    setFiles((previous) => previous.filter((file) => file.id !== id));
    onObservationsChange((observations || []).filter((observation) => observation.__fileId !== id));
    await removeReport(id);
  };

  return (
    <section className="form-section">
      <legend>Upload Reports</legend>
      <div
        className={`dropzone ${isDragActive ? "drag-active" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragActive(true);
        }}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragActive(false);
          handleFiles(event.dataTransfer.files);
        }}
      >
        <p>Drag and drop lab reports here, or click to choose files.</p>
        <p className="hint">Supported: csv, tsv, json, txt, pdf, png, jpg, jpeg (max 10 MB each)</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {files.length > 0 && (
        <ul className="file-list">
          {files.map((file) => (
            <li className="file-list-item" key={file.id}>
              <span>{file.name}</span>
              <span className={`file-status file-status-${file.status}`}>
                {file.error || file.status}
              </span>
              <button type="button" className="btn-secondary" onClick={() => handleRemove(file.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
