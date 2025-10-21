import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
// Note: We don't need a separate index.css since all styling 
// is handled by Tailwind CSS classes within App.jsx.

// This line finds the <div id="root"> element in index.html 
// and renders the main App component inside it.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
