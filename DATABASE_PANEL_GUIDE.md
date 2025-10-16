# Database Panel - User Guide

## Overview
The Database Panel provides comprehensive database monitoring and inspection tools for web applications, including IndexedDB, localStorage, and sessionStorage.

## Fixed Issues

### 1. Script Execution Errors
- **Fixed**: Incorrect variable references in `executeJavaScript` (used `localStorage` instead of `window.localStorage`)
- **Fixed**: Missing null checks for `window.indexedDB.databases()` support
- **Fixed**: Unhandled blocked database states
- **Fixed**: Missing error handling for database operations
- **Fixed**: SQL injection vulnerabilities in query execution

### 2. Enhanced Features
- **Added**: Proper escaping for database/store names with special characters
- **Added**: Query command interpreter with SQL-like syntax
- **Added**: Query results display with formatted JSON
- **Added**: Quick commands helper UI
- **Added**: Better error messages and loading states
- **Added**: Record limit (100 records max) for performance

## Features

### 1. Overview Tab
- **Statistics Cards**: 
  - Total IndexedDB databases
  - Total records across all databases
  - localStorage/sessionStorage item counts
  - Total storage size in KB

- **Detected Connections**: Automatically scans page scripts for:
  - MongoDB
  - PostgreSQL
  - MySQL
  - Firebase/Firestore
  - Supabase
  - GraphQL/Apollo

- **Recent Queries**: Shows last 5 executed queries with status and timing

### 2. Queries Tab
Execute SQL-like commands to interact with IndexedDB:

#### Available Commands

**Show all databases:**
```sql
SHOW DATABASES
```

**Show stores in a database:**
```sql
SHOW STORES FROM mydb
```

**Select data from a store:**
```sql
SELECT * FROM mydb.storename
```

**Clear all data from a store:**
```sql
CLEAR FROM mydb.storename
```

#### Query Results
- Results displayed as formatted JSON
- Limited to 50 records for SELECT queries
- Limited to 100 records for store data viewer
- Execution time displayed in milliseconds
- Success/error status with icons

#### Query History
- Stores up to 100 queries
- Shows timestamp, duration, status
- Displays error messages for failed queries
- Color-coded by status (success=green, error=red)

### 3. IndexedDB Tab
- **Database Browser**: Lists all IndexedDB databases with:
  - Database name and version
  - Number of object stores
  - Store details (key path, auto-increment, indexes)
  - Record counts per store

- **Store Data Viewer**: 
  - Click on any store to view its data
  - Displays formatted JSON
  - Shows all records (limited to 100)

### 4. Storage Tab
- **localStorage**: 
  - Lists all keys and values
  - Shows size in bytes for each item
  - Searchable and expandable

- **sessionStorage**: 
  - Same features as localStorage
  - Cleared when browser tab closes

## Usage Tips

### Testing the Panel

1. **Open the panel**: Press `Cmd+Shift+D` or click the Database icon in the toolbar

2. **Test with a real website**: Navigate to a website that uses IndexedDB (e.g., Twitter, Gmail, Discord)

3. **Try the commands**:
   ```sql
   SHOW DATABASES
   SHOW STORES FROM [database_name]
   SELECT * FROM [database_name].[store_name]
   ```

4. **Inspect localStorage**: Switch to Storage tab to see stored data

### Browser Compatibility

- **IndexedDB.databases()**: Supported in Chrome 71+, Edge 79+
  - Not supported in Firefox (uses workaround detection)
  - Not supported in Safari (uses workaround detection)

- **Fallback behavior**: Panel will show warning if `databases()` not supported

### Performance Considerations

- **Large datasets**: Results limited to 100 records for viewer, 50 for queries
- **Refresh rate**: Click "Refresh" button to update database list
- **Memory usage**: Large JSON objects displayed with scroll container

### Security Notes

- **Query escaping**: All queries are properly escaped to prevent injection
- **Read-only by default**: Only CLEAR command modifies data
- **Same-origin policy**: Can only access databases from current page origin

## Troubleshooting

### Error: "Script failed to execute"
**Cause**: WebView not ready or page hasn't loaded
**Solution**: Wait for page to fully load before opening panel

### Error: "IndexedDB not available"
**Cause**: Page doesn't support IndexedDB or it's disabled
**Solution**: Navigate to a modern website that uses IndexedDB

### Error: "indexedDB.databases() not supported"
**Cause**: Browser doesn't support database enumeration API
**Solution**: Use "SHOW STORES FROM [known_db_name]" if you know the database name

### No databases found
**Possible causes**:
- Page hasn't created any databases yet
- Page is still loading
- Browser's IndexedDB is disabled
- Site uses different storage methods

**Solutions**:
- Interact with the website to trigger database creation
- Click "Refresh" button after interaction
- Check browser's IndexedDB settings

### Query returns empty results
**Check**:
- Database and store names are correct (case-sensitive)
- Store actually contains data
- No errors in Query History

## Examples

### Example 1: Inspect Twitter's Database
```sql
-- Step 1: Find databases
SHOW DATABASES

-- Step 2: List stores (if database is named 'twitter')
SHOW STORES FROM twitter

-- Step 3: View data
SELECT * FROM twitter.tweets
```

### Example 2: Clear a Cache
```sql
-- Clear all cached data from a store
CLEAR FROM myapp.cache
```

### Example 3: Debug localStorage
1. Switch to "Storage" tab
2. Find your app's keys
3. Check values and sizes
4. Verify data persistence

## Keyboard Shortcuts

- `Cmd+Shift+D` - Toggle Database Panel
- `Cmd+Shift+N` - Toggle Network Panel
- `Cmd+Shift+I` - Toggle DevTools Panel

## Future Enhancements (Not yet implemented)

- [ ] WebSQL support (deprecated but still in use)
- [ ] Cookie viewer
- [ ] Cache Storage API viewer
- [ ] Import/Export database functionality
- [ ] Advanced query syntax (WHERE, LIMIT, ORDER BY)
- [ ] Real-time database change monitoring
- [ ] Database schema visualization
