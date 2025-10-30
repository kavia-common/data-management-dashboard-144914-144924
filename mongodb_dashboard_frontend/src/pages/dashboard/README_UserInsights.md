# User Insights Dashboard

This module renders user analytics visualizations powered by existing API hooks:
- useActiveUsers (periodic activity)
- useUserTrends (engagement trend with sessions)
- useActiveUsersByDepartment
- useActiveUsersByOrganization
- useUserCompliance

Components:
- KpiCards: shows KPI totals with theme colors.
- UsersEngagementAreaChart: area/line chart for Active Users and Sessions.
- UsersDepartmentBarChart: bar chart for users by department.
- UsersOrganizationPieChart: pie chart for users by organization.
- ComplianceDonutChart: donut for terms acceptance vs not.

Route:
- /dashboard/user-insights (added in AppRoutes.jsx and Sidebar.jsx)

Styling:
- Primary #2563EB, Secondary (amber) #F59E0B, subtle surfaces and rounded corners.
