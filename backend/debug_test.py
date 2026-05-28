import os, django, io
os.environ['DJANGO_SETTINGS_MODULE'] = 'breathe.settings'
django.setup()

# Test utility parser
with open(r'C:\BreatheESG\sample_data\utility_bill.csv', 'rb') as f:
    from esg.parsers.utility_parser import parse_utility_csv
    results = parse_utility_csv(f)
    print(f'Utility: {len(results)} records parsed')
    if results:
        n = results[0]['normalized']
        print('  Sample date:', n['activity_date'], '| qty:', n['quantity'], 'kWh | co2e:', n['co2e_kg'], '| loc:', n['location'])
    else:
        print('  NO RESULTS')

# Test SAP parser
with open(r'C:\BreatheESG\sample_data\sap_fuel_export.csv', 'rb') as f:
    from esg.parsers.sap_parser import parse_sap_csv
    results2 = parse_sap_csv(f)
    print(f'SAP: {len(results2)} records parsed')
    if results2:
        n2 = results2[0]['normalized']
        print('  Sample date:', n2['activity_date'], '| qty:', n2['quantity'], 'L | co2e:', n2['co2e_kg'], '| loc:', n2['location'])
    else:
        print('  NO RESULTS')

# Clean stale ingestion logs
from esg.models import IngestionLog
deleted = IngestionLog.objects.all().delete()
print('Cleared old ingestion logs:', deleted)
