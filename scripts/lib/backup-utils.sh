#!/bin/bash
#
# Thin wrapper to the canonical SummitFlow backup utilities.
#

CANONICAL_SUMMITFLOW_ROOT="${SUMMITFLOW_BACKUP_ROOT:-$HOME/summitflow}"

source "$CANONICAL_SUMMITFLOW_ROOT/scripts/lib/backup-utils.sh"
