# Stockora Enterprise: Design System

This document captures the branding palettes, typographic properties, CSS rules, and component patterns of **Stockora Enterprise**.

## 1. Color Palette (Dark Mode)
- **Primary Violet**: `#8b5cf6` (Admin dashboards, interactive inputs, navigation).
- **Secondary Emerald**: `#10b981` (POS transaction completions, active stock listings, cash inflows).
- **Deep Slate Background**: `#121212` (Low-contrast backdrops matching warehouse hardware terminals).
- **Paper Background**: `#1e1e1e` (Dialog sheets, inventory catalog cards).

## 2. Typographic Hierarchy
- **Primary Body Font**: `Inter`, sans-serif (Standard readable text).
- **Header Font**: `Outfit`, sans-serif (Geometric, high-contrast, modern).
- **MUI Integration**: Configured globally in `src/client/theme.ts` via customized MUI Theme Provider attributes.

## 3. Responsive Breakpoints
- **Mobile Devices (xs, sm)**: Max-width `600px` (Simplified drawer viewports, barcode scanner alignments).
- **Tablets (md)**: Width `600px` to `960px` (Two-column POS catalogs).
- **Desktops (lg, xl)**: Width `960px` and up (Full-width AG Grid catalogs and multi-area analytics charts).
