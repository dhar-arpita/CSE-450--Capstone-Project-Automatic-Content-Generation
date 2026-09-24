import React from "react";
import { IconClose, IconSearch } from "./icons";
import "./SearchBox.css";

/* A plain, reusable search field — the rail panels and the profile's content
   table both need "type anything, filter the list", and neither wants its
   own copy of the icon-plus-clear-button markup. */
export default function SearchBox({ value, onChange, placeholder, size = "sm" }) {
  return (
    <div className={`sbx sbx-${size}`}>
      <span className="sbx-icon"><IconSearch /></span>
      <input
        type="text"
        className="sbx-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {value && (
        <button
          type="button"
          className="sbx-clear"
          onClick={() => onChange("")}
          aria-label="Clear"
        >
          <IconClose />
        </button>
      )}
    </div>
  );
}
