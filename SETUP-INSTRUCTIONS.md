# Dating App Report System Setup Instructions

## Google Sheets Integration Setup

### Step 1: Create Google Apps Script

1. **Create Google Sheet:**
   - Go to [Google Sheets](https://sheets.google.com)
   - Create a new blank spreadsheet
   - Note the Sheet ID from the URL (the long string after `/spreadsheets/d/`)

2. **Set up Google Apps Script:**
   - In your Google Sheet, go to **Extensions → Apps Script**
   - Delete the default `myFunction()` code
   - Copy and paste the code from `google-apps-script.js` into the script editor
   - Replace `YOUR_GOOGLE_SHEET_ID_HERE` with your actual Sheet ID

3. **Configure the Script:**
   - Click on **Deploy → New deployment**
   - Click the gear icon next to "Type" and select **Web app**
   - Set **Execute as:** to **Me (your email)**
   - Set **Who has access:** to **Anyone**
   - Click **Deploy** and authorize the permissions
   - Copy the deployment URL (it will look like: `https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec`)

4. **Update Your App:**
   - Open `script.js`
   - Find the line with the Google Apps Script URL
   - Replace the URL with your deployment URL

### Step 2: Configure CORS Properly

The CORS error occurs because your local development server (http://127.0.0.1:5500) is trying to access the Google Apps Script. The provided Google Apps Script includes proper CORS headers to handle this.

### Step 3: Test the Integration

1. **Test the script:**
   - Run the `testReportSubmission()` function in Google Apps Script to verify it works
   - Check your Google Sheet to see if test data appears

2. **Test from your app:**
   - Start your dating app
   - Connect with a user
   - Try reporting a user
   - Check both Firebase and Google Sheets for the report data

### Troubleshooting

#### CORS Issues
If you still encounter CORS issues:
- Ensure your Google Apps Script has the CORS headers as shown in `google-apps-script.js`
- Try using `no-cors` mode in the fetch request (already implemented)
- Reports will still be saved to Firebase as a backup

#### Firebase Only Mode
If Google Sheets integration fails, reports will automatically be stored in Firebase under:
```
/reports/{reporter_user_id}/{reported_user_id}
```

You can export this data from Firebase Console later.

### Alternative: Firebase-Only Setup

If you prefer not to use Google Sheets:
1. Simply ignore the Google Apps Script setup
2. Reports will be stored exclusively in Firebase
3. You can view reports in Firebase Console → Realtime Database → reports

### Security Notes

- The Google Apps Script URL is publicly accessible, but it only accepts POST requests
- All reports are timestamped and include user IDs for tracking
- Consider adding rate limiting in production
- Regularly review and clean up old reports

### Customization

You can customize the report reasons by modifying:
- The radio button options in `index.html`
- The corresponding values in the Google Apps Script validation
- The Firebase security rules for reports