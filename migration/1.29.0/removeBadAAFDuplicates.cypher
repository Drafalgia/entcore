match (u:User)-[r:DUPLICATE]->(u2:User) where u.source IN ['AAF','AAF1D'] and u2.source IN ['AAF','AAF1D'] and not(has(u.deleteDate)) and not(has(u2.deleteDate)) and not(has(u.disappearanceDate)) and not(has(u2.disappearanceDate)) delete r;
