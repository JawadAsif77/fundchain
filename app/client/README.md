# InvestHub - Investment & Crowdfunding Platform

A modern React-based investment and crowdfunding platform built with Vite. This is **Phase 1** - a frontend-only application with mock data demonstrating the complete user interface and user experience.

## 🚀 Features

### Core Functionality
- **Browse Campaigns**: Explore investment opportunities with advanced filtering and search
- **Campaign Details**: View detailed campaign information, milestones, and progress
- **User Authentication**: Login/register with localStorage-based session management
- **Dashboard**: Role-based dashboards for investors and project creators
- **Responsive Design**: Mobile-first design that works on all devices

### User Roles
- **Investors**: Browse projects, view investment history, track portfolio
- **Creators**: Manage campaigns, view raised funds, track project milestones

### UI Components
- Advanced filtering and search functionality
- Pagination for large datasets
- Progress tracking and milestone visualization
- Mobile-responsive navigation
- Accessible form components

## 🛠 Tech Stack

- **Frontend**: React 18.2.0
- **Build Tool**: Vite 4.4.5
- **Routing**: React Router DOM 6.15.0
- **Styling**: Plain CSS with CSS custom properties
- **State Management**: React Context API
- **Data**: Mock data (JSON files)

## 📁 Project Structure

```
/app/client/
├── package.json
├── index.html
├── vite.config.js
├── README.md
└── /src
    ├── main.jsx                 # App entry point
    ├── App.jsx                  # Main app component with routing
    ├── /pages                   # Page components
    │   ├── Home.jsx            # Landing page with hero and featured projects
    │   ├── Explore.jsx         # Campaign browsing with filters
    │   ├── Campaign.jsx        # Individual campaign details
    │   ├── Login.jsx           # User authentication
    │   ├── Register.jsx        # User registration
    │   ├── Dashboard.jsx       # User dashboard (protected)
    │   └── NotFound.jsx        # 404 error page
    ├── /components             # Reusable components
    │   ├── Header.jsx          # Navigation header
    │   ├── Footer.jsx          # Site footer
    │   ├── CampaignCard.jsx    # Campaign preview cards
    │   ├── FilterBar.jsx       # Search and filter controls
    │   ├── MilestoneList.jsx   # Project milestone display
    │   ├── InvestPanel.jsx     # Investment form (disabled in Phase 1)
    │   ├── ProtectedRoute.jsx  # Authentication guard
    │   ├── Loader.jsx          # Loading spinner
    │   ├── EmptyState.jsx      # Empty state placeholder
    │   └── Pagination.jsx      # Page navigation
    ├── /styles                 # CSS stylesheets
    │   ├── globals.css         # Global styles and CSS variables
    │   ├── layout.css          # Layout and grid systems
    │   ├── card.css            # Card components and badges
    │   ├── form.css            # Form styling
    │   └── util.css            # Utility classes
    ├── /mock                   # Mock data files
    │   ├── campaigns.js        # Campaign data
    │   ├── milestones.js       # Project milestones
    │   ├── users.js            # User accounts
    │   └── investments.js      # Investment records
    ├── /store                  # State management
    │   └── AuthContext.jsx     # Authentication context
    └── /lib                    # Utilities and API layer
        └── api.js              # API abstraction (Phase 2 ready)
```

## 🚀 Getting Started

### Prerequisites
- Node.js 16.0.0 or higher
- npm or yarn package manager

### Installation

1. **Clone and navigate to the project**:
   ```bash
   cd app/client
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser** and visit: `http://localhost:5173`

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally

## 🎮 Usage Guide

### Demo Accounts
The application includes pre-configured demo accounts:

**Investor Account**:
- Email: `investor@example.com`
- Password: `demo` (or any password)

**Creator Account**:
- Email: `creator@example.com`
- Password: `demo` (or any password)

### Key Features to Test

1. **Browse Campaigns** (`/explore`):
   - Use search to find specific campaigns
   - Filter by category, status, and sort options
   - Pagination works with filtered results
   - URL parameters sync with filters

2. **Campaign Details** (`/campaign/[slug]`):
   - View detailed campaign information
   - Navigate between Overview, Milestones, Updates, and Q&A tabs
   - Investment panel shows Phase 2 notice

3. **Authentication**:
   - Register new accounts (creates investor role by default)
   - Login with demo accounts
   - Protected routes redirect to login

4. **Dashboard** (`/dashboard`):
   - Role-based content (investor vs creator views)
   - Investment history for investors
   - Campaign management for creators
   - Role switching for UI testing (dev feature)

5. **Responsive Design**:
   - Test on different screen sizes
   - Mobile navigation menu
   - Touch-friendly interactions

## 🎨 Design System

### Color Palette
- **Primary**: Blue (`#2563eb`)
- **Secondary**: Green (`#059669`)
- **Gray Scale**: 50-900 scale for text and backgrounds
- **Status Colors**: Success, Warning, Danger, Info

### Typography
- **Font Family**: System font stack (SF Pro, Segoe UI, etc.)
- **Scale**: 6 size levels (xs to 3xl)
- **Weights**: Normal, Medium, Semibold, Bold

### Components
- Cards with hover effects and shadows
- Buttons with multiple variants and sizes
- Forms with validation states and accessibility
- Badges and status indicators
- Progress bars and loading states

## 🔒 Authentication (Phase 1)

The current authentication system is **mock-only** for demonstration:

- Uses localStorage for session persistence
- Simple email/password validation
- No real security or password hashing
- Demo accounts are hardcoded

**Phase 2** will implement real authentication with Supabase.

## 📊 Mock Data

The application includes realistic mock data:

- **8 Campaigns** across 6 categories
- **3 Status types**: Live, Draft, Completed
- **20 Milestones** with various completion states
- **2 Users**: One investor, one creator
- **4 Investments** linking investors to campaigns

## 🔄 Phase 2 Preparation

The codebase is structured for easy Phase 2 integration:

### API Layer (`/src/lib/api.js`)
- Functions that currently return mock data
- Ready to be replaced with Supabase calls
- Consistent return format for easy swapping

### Database Hooks
- Comments marked with `// PHASE 2:` throughout the code
- Placeholder functions for create/update operations
- Error handling structure in place

### Authentication
- AuthContext designed for easy Supabase auth integration
- Login/register flows ready for real backend
- Role management structure established

## 🐛 Known Limitations (Phase 1)

- No real data persistence (refreshing loses state)
- Investment processing is disabled with user-friendly messages
- Campaign creation shows "coming in Phase 2" notices
- User profile editing is not functional
- No real-time updates or notifications

## 📱 Browser Support

- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+

## 🔧 Development

### Code Style
- Functional React components with hooks
- Modular CSS with utility classes
- Semantic HTML with accessibility considerations
- Mobile-first responsive design

### Testing
- Manual testing checklist included
- All routes and user flows verified
- Cross-browser compatibility tested
- Mobile responsiveness validated

## 🎯 Next Steps (Phase 2)

1. **Database Integration**: Replace mock data with Supabase
2. **Real Authentication**: Implement Supabase Auth
3. **Investment Processing**: Add payment integration
4. **Campaign Creation**: Build full CRUD operations
5. **Real-time Updates**: Add live data synchronization
6. **File Uploads**: Campaign images and documents
7. **Notifications**: Email and in-app notifications
8. **Advanced Features**: Comments, messaging, analytics

## 📄 License

This project is part of a Final Year Project (FYP) demonstration.

## 🤝 Contributing

This is a demonstration project for Phase 1 development. Phase 2 will include collaboration guidelines.

---

**Built with ❤️ using React + Vite**