# Complex Notation Alignment Improvements

This document describes the improvements made to handle complex musical notation in the aligned score view, particularly for pieces with intricate structures like Chopin nocturnes.

## Problem Statement

The original implementation had several issues when dealing with complex notation:

1. **Beam handling**: Assumed simple beam structures and used document-level selectors
2. **Chord stems**: Rigid assumptions about stem path formats
3. **Tie rendering**: Hard-coded offsets that didn't work for all layouts
4. **Error handling**: Lack of defensive programming for edge cases
5. **Coordinate parsing**: Insufficient validation of SVG transform attributes

## Solutions Implemented

### 1. Enhanced Beam Processing

**Before:**
```javascript
const beams = document.querySelectorAll('.beam'); // Wrong selector scope
const x1 = stem1.getAttribute('d')?.split(' ')[0].slice(1); // Unsafe parsing
```

**After:**
```javascript
const beams = this.svg.querySelectorAll('.beam'); // Correct scope
const d1 = stem1.getAttribute('d');
if (!d1) continue; // Validation
const x1 = parts1[0].startsWith('M') ? parts1[0].slice(1) : parts1[0]; // Flexible parsing
```

### 2. Robust Chord Stem Handling

**Before:**
```javascript
if (parts.length !== 4) continue; // Rigid assumption
```

**After:**
```javascript
if (parts.length < 2) continue; // Flexible requirement
// Handle different path formats (M x y L x y vs coordinate pairs)
```

### 3. Improved Tie Rendering

**Before:**
```javascript
const x1 = (parseTranslate(...) || 0) + 300; // Hard-coded offset
```

**After:**
```javascript
const noteWidth = 200; // Configurable
const x1 = startX + noteWidth; // Dynamic calculation
if (Math.abs(x2 - x1) < 50) continue; // Minimum length validation
```

### 4. Comprehensive Error Handling

Added try-catch blocks and validation throughout:

```javascript
try {
  const svgCoords = toSVG([span.onsetMs, 0]);
  if (svgCoords && typeof svgCoords[0] === 'number') {
    aligner.shiftNote(svgNote, svgCoords[0])
  }
} catch (error) {
  console.warn('Failed to shift note position:', error)
}
```

### 5. Enhanced Helper Functions

**parseTranslate**: Added input validation and NaN checking
**shiftPath**: Added error handling and input validation

## Testing

The improvements were validated with:

1. **Edge case testing**: Null inputs, malformed data, extreme values
2. **Build verification**: Successful TypeScript compilation and linting
3. **Function isolation**: Individual testing of helper functions

## Benefits

These improvements provide:

- **Robustness**: Graceful handling of unexpected notation structures
- **Flexibility**: Support for various SVG path formats and beam configurations
- **Reliability**: Comprehensive error handling prevents crashes
- **Maintainability**: Better code structure with clear validation patterns

## Compatibility

All improvements maintain backward compatibility while adding new capabilities for complex notation scenarios.