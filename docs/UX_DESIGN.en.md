# UX Documentation - Inbox → Actions Interface

Complete documentation of the user interface for action management.

---

## UX Philosophy

The Inbox → Actions interface follows these fundamental principles:

1. **Clarity above all** - Every possible action is clearly visible and accessible
2. **Source sentence always visible** - The context of the action is always displayed
3. **Quick actions** - Maximum 2 clicks to accomplish a common task
4. **Immediate feedback** - Every action generates a notification (toast)
5. **Consistency** - Exclusive use of shadcn/ui for uniform design

---

## Pages

### 1. `/actions` - Actions List

**Objective**: Overview of all actions with status filtering

**Structure**:
```
┌─────────────────────────────────────────────┐
│ Today's actions                             │
├─────────────────────────────────────────────┤
│ [Today 4] [Upcoming 2] [Completed] [Ignored]│
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │ ActionCard                          │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │ ActionCard                          │    │
│  └─────────────────────────────────────┘    │
│                                             │
└─────────────────────────────────────────────┘
```

**Features**:
- 4 filter tabs: **Today**, **Upcoming**, **Completed**, **Ignored**
- Badges (counters) on "Today" and "Upcoming"; tabs with no actions are disabled (grayed out)
- Infinite scroll with sentinel IntersectionObserver (pagination: 20 items/page)
- Adaptive skeletons per tab (variant `default` or `done-ignored`)
- Custom empty state per tab
- Optimistic counter updates after each mutation

**Virtual filters**:
- **Today**: `TODO` actions with no date, or scheduled for today (`dueDate≤23:59:59`)
- **Upcoming**: `TODO` actions with `isScheduled=true` and `dueDate` strictly after today
- **Completed**: `DONE` actions
- **Ignored**: `IGNORED` actions

**User flow**:
1. Arrival on page → Display "Today" actions
2. Click on a tab → Load and display filtered actions
3. Scroll down → Automatically load next page
4. Actions on cards → Optimistic counter updates

### 2. `/actions/[id]` - Action Detail

**Objective**: Detailed view of an action with all metadata

**Structure**:
```
┌─────────────────────────────────────────────┐
│ [← Back to actions]              [✎] [🗑]   │
├─────────────────────────────────────────────┤
│                                             │
│  Action title                               │
│  📧 from@example.com • ⏰ Received 2h ago  │
│  [Type badge] [Status badge]                │
│                                             │
│  Source sentence                            │
│  ┌─────────────────────────────────────┐    │
│  │ "Could you send me..."              │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Due date                                   │
│  ┌─────────────────────────────────────┐    │
│  │ Urgent: January 5, 2026, 2:00 PM    |    |
│  └─────────────────────────────────────┘    │
│                                             │
│  Created on │ Modified on                   │
│                                             │
│  [V Mark as done] [X Ignore]                |
│                                             │
└─────────────────────────────────────────────┘
```

**Features**:
- Back button to /actions
- Quick buttons: Edit (dialog), Delete (confirmation)
- Complete display of all information
- Visual urgency indicators (colors)
- Available actions based on status
- Confirmation dialog for deletion
- Automatic redirect after deletion
- Error handling (404, 403)

**User flow**:
1. Click "View details" or "Edit" on a card
2. Review complete information
3. Possible actions:
   - Edit → Edit dialog
   - Delete → Confirmation → Return to /actions
   - Mark done/ignore → Status update
   - Back → Return to /actions

---

## Components

### 1. `ActionCard` - Action Card

**Responsibility**: Display an action concisely with quick actions

**Variants**:
- `default`: Complete card with all details
- `compact`: Condensed version for dense lists

**Information displayed**:
- Title (bold, prominent)
- Sender email
- Received date (relative)
- Action type (colored badge)
- Status (badge)
- Source sentence (always visible, italic, gray background)
- Due date if present (with urgency indicators)

**Available actions (if TODO)**:
- ✓ Done - Marks the action as completed (DONE)
- 📅 Schedule / Reschedule - Opens the date picker ("Schedule" if no dueDate, "Reschedule" otherwise)
- ✗ Ignore - Marks the action as ignored (IGNORED)
- ··· Context menu - Sender/domain exclusion

**Actions (if DONE/IGNORED)**:
- 🔗 View details - Opens the detail page
- The scheduling panel and exclusion menu are hidden

**Visual indicators**:
- ⚠️ Overdue: Red border, light red background (`dueDate` is past)
- ⏰ Urgent (< 24h): Orange border, light orange background
- 📅 Scheduled (neutral): Blue border, light blue background (future, not urgent)
- Normal: Default border (no dueDate)

**Props**:
```typescript
interface ActionCardProps {
  action: ActionWithUser;
  onUpdate?: (newStatus?: "DONE" | "IGNORED" | "SCHEDULED" | "TODO") => void;
}
```

> The `newStatus` passed to `onUpdate` is a logical signal:
> - `"DONE"` / `"IGNORED"` → remove card, increment destination counter
> - `"SCHEDULED"` → card moves to "Upcoming" (increment scheduledCount)
> - `"TODO"` → card stays/returns in "Today" (reload list)
> - `undefined` → simple removal without increment

### 2. `ActionList` - Action List

**Responsibility**: Wrapper to display multiple ActionCards

**Features**:
- Vertical grid display (space-y-4)
- Empty state handling
- Customizable messages for empty state
- onUpdate callback propagation

**Props**:
```typescript
interface ActionListProps {
  actions: ActionWithUser[];
  onUpdate?: () => void;
  variant?: "default" | "compact";
  emptyMessage?: string;
  emptyDescription?: string;
}
```

### 3. `ActionDialog` - Create/Edit Dialog

**Responsibility**: Modal form to create or edit an action

**Modes**:
- **Creation**: All fields empty + "Received date" field
- **Edition**: Pre-filled fields, no "Received date"

**Fields**:
- Title * (text, required)
- Type * (select, required): SEND, CALL, FOLLOW_UP, PAY, VALIDATE
- Source sentence * (textarea, required)
- Sender email * (email, required)
- Received date * (datetime-local, required, creation only)
- Due date (datetime-local, optional)

**Validation**:
- Required fields verified by HTML5
- Email type validated
- Error messages displayed via toast

**Actions**:
- Cancel - Closes the dialog
- Create/Edit - Submit with loading state

**Props**:
```typescript
interface ActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action?: ActionWithUser;
  onSuccess?: () => void;
}
```

### 4. `EmptyState` - Empty State

**Responsibility**: Display when no action is available

**Elements**:
- Icon (Inbox by default, customizable)
- Main message
- Secondary description

**Props**:
```typescript
interface EmptyStateProps {
  message?: string;
  description?: string;
  icon?: React.ReactNode;
}
```

### 5. `ActionsHeader` - Page Header

**Responsibility**: Page title + creation button

**Elements**:
- Title "Actions"
- Description "Manage your actions..."
- "New action" button (with Plus icon)
- Integrated creation dialog

**Props**:
```typescript
interface ActionsHeaderProps {
  onActionCreated?: () => void;
}
```

---

## Design System

### Action Type Colors

| Type | Label | Color |
|------|-------|-------|
| SEND | Send | Blue (bg-blue-100 text-blue-800) |
| CALL | Call | Green (bg-green-100 text-green-800) |
| FOLLOW_UP | Follow up | Yellow (bg-yellow-100 text-yellow-800) |
| PAY | Pay | Purple (bg-purple-100 text-purple-800) |
| VALIDATE | Validate | Orange (bg-orange-100 text-orange-800) |

### Status Colors

| Status | Label | Color |
|--------|-------|-------|
| TODO | To do | Gray (bg-slate-100 text-slate-800) |
| DONE | Done | Green (bg-green-100 text-green-800) |
| IGNORED | Ignored | Gray (bg-gray-100 text-gray-800) |

### Urgency States

| State | Condition | Style |
|-------|-----------|-------|
| Overdue | dueDate < now & status=TODO | border-red-300 bg-red-50/50 |
| Urgent | dueDate < now+24h & status=TODO | border-orange-300 bg-orange-50/50 |
| Normal | Other | Default style |

---

## Complete User Flows

### Flow 1: Create an action

1. User clicks "New action" in the header
2. Dialog opens with all fields empty
3. User fills out the form
4. User clicks "Create"
5. Loading state displayed on button
6. API request POST /api/actions
7. If success:
   - Toast "Action created successfully"
   - Dialog closes
   - List refreshes
   - Form resets
8. If error:
   - Toast with error message
   - Dialog stays open
   - User can correct

### Flow 2: Mark an action as done

#### From the list
1. User clicks "Done" on an ActionCard
2. Loading state on all card buttons
3. API request POST /api/actions/:id/done
4. If success:
   - Toast "Action marked as completed"
   - List refreshes
   - Action disappears from TODO tab
5. If error:
   - Toast with error message
   - No change

#### From the detail page
1. User clicks "Mark as done"
2. Loading state on all buttons
3. API request POST /api/actions/:id/done
4. If success:
   - Toast "Action marked as completed"
   - Page refreshes
   - Action buttons change (no more "Done/Ignore")
5. If error:
   - Toast with error message
   - No change

### Flow 3: Edit an action

1. User clicks "Edit" (list or detail)
2. If from list: Navigation to /actions/:id
3. User clicks the Edit icon (✎)
4. Edit dialog opens with pre-filled data
5. User modifies fields
6. User clicks "Edit"
7. Loading state displayed
8. API request PATCH /api/actions/:id
9. If success:
   - Toast "Action modified successfully"
   - Dialog closes
   - Data refreshes
10. If error:
    - Toast with error message
    - Dialog stays open

### Flow 4: Delete an action

1. User goes to /actions/:id
2. User clicks the Delete icon (🗑)
3. Confirmation dialog opens
4. User clicks "Delete"
5. Loading state displayed
6. API request DELETE /api/actions/:id
7. If success:
   - Toast "Action deleted"
   - Redirect to /actions
8. If error:
   - Toast with error message
   - Dialog closes
   - User stays on the page

### Flow 5: Filter actions

1. User arrives on /actions
2. "To do" tab selected by default
3. TODO actions displayed
4. User clicks "Completed"
5. Loading state displayed
6. API request GET /api/actions?status=DONE
7. DONE actions displayed
8. Counter updated

---

## Best Practices Followed

### 1. Accessibility
- Use of accessible shadcn/ui components
- Labels on all inputs
- Clear error messages
- Visible loading states

### 2. Mobile UX
- Responsive design (grid, flex)
- Adequate button sizes
- Mobile-adapted dialogs

### 3. Performance
- Separate loading per tab
- No unnecessary global reloads
- Optimistic UI where possible
- Loading states for immediate feedback

### 4. User Feedback
- Toast for all actions
- Loading states everywhere
- Explicit errors
- Confirmations for destructive actions

### 5. Security
- Client AND server side validation
- Confirmation before deletion
- Error messages without info leaks

### 6. Consistency
- Same design system everywhere
- Same information layout
- Same action flow
- Consistent terminology

---

## Possible Evolutions

### Short term
- [ ] Sort actions (by date, urgency)
- [ ] Full-text search
- [ ] Combined filters (type + status)
- [ ] Pagination if > 50 actions

### Medium term
- [ ] Bulk actions (multiple selection)
- [ ] CSV/PDF export
- [ ] Keyboard shortcuts
- [ ] Drag and drop to reorder

### Long term
- [ ] Calendar view
- [ ] Push notifications
- [ ] Direct email integration
- [ ] AI for categorization

---

## UX Metrics to Track

### Engagement
- Number of actions created/day
- Completion rate (DONE / TOTAL)
- Average time to mark an action as done

### Usability
- Abandonment rate in creation form
- Average number of clicks to accomplish a task
- Error rate in forms

### Performance
- Load time for /actions
- Response time for actions (Done/Ignore)

---

## Summary

The Inbox → Actions interface is designed to be:

✅ **Simple** - No learning curve
✅ **Fast** - Actions in 1-2 clicks
✅ **Clear** - Source sentence always visible
✅ **Consistent** - shadcn/ui everywhere
✅ **Accessible** - Standards respected
✅ **Feedback** - Toast and loading states

Users can create, view, edit, delete, and filter their actions with ease.
