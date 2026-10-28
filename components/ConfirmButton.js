"use client";

export default function ConfirmButton({ message = "Are you sure?", className = "btn-danger", children }) {
  return (
    <button className={className} onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}>
      {children}
    </button>
  );
}
