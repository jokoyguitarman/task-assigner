# Task Assigner

A comprehensive task assignment web application with mobile support for Admin and Staff users. Built with React, TypeScript, and Material-UI.

## Features

### Admin Features
- **Task Management**: Create, edit, and delete tasks with estimated completion times
- **Assignment System**: Assign tasks to staff members with due dates
- **Recurring Tasks**: Schedule daily, weekly, or monthly recurring tasks
- **Time Tracking**: Monitor task completion and deduct time for overdue tasks
- **Dashboard**: Overview of all assignments, pending tasks, and completion statistics

### Staff Features
- **Task Viewing**: View assigned tasks with details and due dates
- **Completion Proof**: Submit photo or video proof when completing tasks
- **Progress Tracking**: Monitor personal task completion and time efficiency
- **Mobile Optimized**: Responsive design for mobile devices

### Technical Features
- **PWA Support**: Progressive Web App with offline capabilities
- **Role-based Access**: Separate interfaces for Admin and Staff users
- **Real-time Updates**: Live task status updates
- **Media Capture**: Built-in camera functionality for task completion proof
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Demo Accounts

- **Admin**: `admin@taskassigner.com` (any password)
- **Staff**: `staff1@taskassigner.com` (any password)

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd task-assigner
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm start
   ```

4. **Open your browser**
   Navigate to `http://localhost:3000`

## Available Scripts

- `npm start` - Runs the app in development mode
- `npm build` - Builds the app for production
- `npm test` - Launches the test runner
- `npm run lint` - Runs ESLint for code quality
- `npm run format` - Formats code with Prettier

## Project Structure

```
src/
├── components/
│   ├── admin/           # Admin-specific components
│   ├── staff/           # Staff-specific components
│   ├── auth/            # Authentication components
│   └── layout/          # Layout components
├── contexts/            # React contexts (Auth, etc.)
├── services/            # API services and data management
├── types/               # TypeScript type definitions
└── App.tsx              # Main application component
```

## Technology Stack

- **Frontend**: React 18, TypeScript
- **UI Framework**: Material-UI (MUI)
- **State Management**: React Query, React Context
- **Routing**: React Router DOM
- **Forms**: React Hook Form
- **Date Handling**: date-fns, MUI X Date Pickers
- **PWA**: Service Workers, Web App Manifest
- **Build Tool**: Create React App

## Key Components

### Admin Components
- `Dashboard` - Overview of all tasks and assignments
- `TaskList` - Manage tasks (create, edit, delete)
- `AssignmentList` - Manage task assignments
- `TaskForm` - Create/edit task form
- `AssignmentForm` - Create/edit assignment form

### Staff Components
- `StaffDashboard` - Personal task overview
- `TaskCompletion` - Complete tasks with proof submission

### Shared Components
- `LoginForm` - Authentication interface
- `AppLayout` - Main application layout with navigation

## API Structure

The application uses a mock API service that simulates backend functionality:

- `authAPI` - User authentication
- `tasksAPI` - Task management
- `assignmentsAPI` - Task assignment management
- `usersAPI` - User management
- `workingHoursAPI` - Time tracking

## Mobile Features

- **Responsive Design**: Optimized for mobile screens
- **Touch-friendly**: Large buttons and touch targets
- **Camera Integration**: Direct camera access for task completion
- **PWA Installation**: Can be installed as a mobile app
- **Offline Support**: Basic offline functionality with service workers

## Time Tracking System

- Tasks have estimated completion times in minutes
- Overdue tasks automatically deduct time from staff working hours
- Admin can monitor time efficiency and completion rates
- Staff can view their time allocation and progress

## Future Enhancements

- Real backend API integration
- Push notifications for task assignments
- Advanced reporting and analytics
- Team collaboration features
- Integration with calendar systems
- Advanced media handling and storage

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.
