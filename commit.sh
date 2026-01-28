# Source - https://stackoverflow.com/q
# Posted by mgold, modified by community. See post 'Timeline' for change history
# Retrieved 2026-01-28, License - CC BY-SA 3.0

#!/bin/bash  
git add .  
read -p "Commit description: " desc  
git commit -m "$desc"
git push 

