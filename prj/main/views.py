from django.shortcuts import render

def get_whole_name(user):
    return " ".join((user.first_name, user.last_name))

# Create your views here.
async def homepage(request):
    name = get_whole_name(await request.auser())
    
