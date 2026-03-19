# ScenarijPro ✍️

A full-stack web application for writing and collaboratively editing screenplays. Built as a university project across four development sprints, the app covers everything from a static UI to a fully functional backend with database versioning.

---

## Features

- 📄 **Screenplay Editor** — rich text editor with bold, italic, and underline formatting; automatic role and dialogue detection
- 👥 **Collaborative Editing** — locking mechanism prevents conflicts when multiple users edit simultaneously
- 🔄 **Version Control** — checkpoint system allows restoring a scenario to any previous state
- 📊 **Script Analysis** — word count, role detection, similar name warnings, dialogue grouping
- 🗃️ **REST API** — full backend with JSON responses and proper HTTP status codes

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, JavaScript (Vanilla) |
| Backend | Node.js, Express.js |
| Database | MySQL, Sequelize ORM |
| Communication | AJAX (Fetch API) |

---

## Project Structure

```
ScenarijPro/
├── html/
│   ├── projects.html      # Project overview page
│   ├── writing.html       # Screenplay editor
│   └── user.html          # User profile settings
├── css/
│   ├── projects.css
│   ├── writing.css
│   └── user.css
├── js/
│   ├── EditorTeksta.js    # Core editor module
│   ├── PoziviAjaxFetch.js # AJAX communication module
│   └── editor.js          # Frontend-backend connector
├── routes/                # Express route handlers
├── models/                # Sequelize models
└── data/                  # (Spiral 3 only) JSON file storage
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/scenarios` | Create a new scenario |
| GET | `/api/scenarios/:id` | Get scenario by ID |
| POST | `/api/scenarios/:id/lines/:lineId/lock` | Lock a line for editing |
| PUT | `/api/scenarios/:id/lines/:lineId` | Update a line |
| POST | `/api/scenarios/:id/characters/lock` | Lock a character name |
| POST | `/api/scenarios/:id/characters/update` | Rename a character |
| GET | `/api/scenarios/:id/deltas?since=` | Get changes since timestamp |
| POST | `/api/scenarios/:id/checkpoint` | Create a version checkpoint |
| GET | `/api/scenarios/:id/checkpoints` | List all checkpoints |
| GET | `/api/scenarios/:id/restore/:checkpointId` | Restore to a checkpoint |

---

## Getting Started

### Prerequisites
- Node.js
- MySQL

### Installation

```bash
# Clone the repository
git clone https://github.com/rubina-rekic/ScenarijPro.git
cd ScenarijPro

# Install dependencies
npm install

# Set up the database
# Make sure MySQL is running with:
# user: root | password: password | database: wt26

# Start the server
node index.js
```

Open `html/projects.html` in your browser to view the frontend.

---

## Development Sprints

| Branch | Sprint | Focus |
|--------|--------|-------|
| `spirala1` | Sprint 1 | Static HTML/CSS UI — three pages |
| `spirala2` | Sprint 2 | JavaScript editor module with script analysis |
| `spirala3` | Sprint 3 | Node.js/Express REST API with JSON file storage |
| `master` | Sprint 4 | MySQL + Sequelize migration, checkpoint/versioning system |

---

## Author

**Rubina Rekić**
Electrical Engineering Faculty, Sarajevo
Web Technologies — Academic Year 2025/26
