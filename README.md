# Habit Tracker

A lightweight, offline-first habit tracking progressive web app (PWA) built with vanilla JavaScript and Vite.

## Features

- **Simple & Fast**: Built with vanilla JS, no frameworks or dependencies
- **Offline First**: All data stored locally in browser (localStorage)
- **PWA Ready**: Install as a native app on any device
- **Responsive**: Works at 360px and up; dark mode via system preferences
- **Accessible**: Semantic HTML, ARIA labels, keyboard navigation
- **No Backend**: 100% client-side, no server or authentication needed

## Getting Started

### Prerequisites

- Node.js 14+ and npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Starts the dev server on `http://localhost:5173`.

### Testing

```bash
npm run test
```

Runs Vitest test suite covering all store functionality, including streak edge cases (gaps, today-not-done, corrupt storage).

### Build for Production

```bash
npm run build
```

Creates optimized build in `dist/` folder.

### Preview Production Build

```bash
npm run preview
```

## Usage

1. **Add a Habit**: Enter a habit name (up to 60 chars) in the form and press Enter or click the button
2. **Track Today**: Check the checkbox next to a habit to mark it done for today
3. **View Streak**: See your current streak (consecutive days) for each habit
4. **Delete Habit**: Click delete to remove a habit permanently

## Data Structure

Data is stored in localStorage under the key `habit-tracker:v1`:

```javascript
{
  habits: [
    {
      id: "unique-id",
      name: "Exercise",
      createdAt: "2025-06-15",
      days: ["2025-06-13", "2025-06-14", "2025-06-15"]
    }
  ]
}
```

## Netlify Deploy

### Automatic Deployment

The `netlify.toml` file configures automatic builds:

```toml
[build]
  command = "npm run build"
  publish = "dist"
```

Push to your git repository to trigger automatic builds and deploys.

### Manual Deploy

```bash
npm install -g netlify-cli
netlify deploy --prod
```

### Environment

- **Build command**: `npm run build`
- **Publish directory**: `dist/`
- **Node version**: 18+ recommended

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 15+
- Works on iOS and Android with PWA support

## License

MIT
