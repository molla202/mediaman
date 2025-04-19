# coding: utf-8
import psutil
import json
from falcon import HTTP_200, HTTP_500
from ..config import DISK_PATH


class SystemStats:
    def on_get(self, req, res):
        stats = {}

        try:
            # cpu stats
            stats['cpu'] = {}
            stats['cpu']['cores'] = {}
            stats['cpu']['cores']['total'] = psutil.cpu_count(logical=True)
            stats['cpu']['cores']['physical'] = psutil.cpu_count(logical=False)
            stats['cpu']['percentage'] = psutil.cpu_percent()

            # memory stats
            stats['ram'] = {}
            system_virtual_memory = psutil.virtual_memory()
            stats['ram']['total'] = system_virtual_memory.total
            stats['ram']['used'] = system_virtual_memory.used
            stats['ram']['available'] = system_virtual_memory.available
            stats['ram']['percentage'] = system_virtual_memory.percent

            # disk stats
            stats['disk'] = {}
            disk = psutil.disk_usage(DISK_PATH)
            stats['disk']['total'] = disk.total
            stats['disk']['used'] = disk.used
            stats['disk']['available'] = disk.free
            stats['disk']['percentage'] = disk.percent

            res.status = HTTP_200
            res.body = json.dumps({
                'success': True,
                'result': stats
            })

        except Exception as e:
            res.status = HTTP_500
            res.body = json.dumps({
                'success': False,
                'error': {
                    'message': 'Error occured while fetching system stats.'
                }
            })
